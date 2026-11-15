import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  authenticate,
  createCircle,
  createInvite,
  LOCKOUT_MINUTES,
  MAX_FAILED_ATTEMPTS,
  redeemInvite,
} from "@/lib/server/circle-service";
import { applyMedicationChange, recordDose, undoDose } from "@/lib/server/medication-service";
import { sha256 } from "@/lib/server/crypto";
import { addMed, db, makeCircle, resetDb, utc } from "./helpers";
import { TEST_PIN, TEST_PIN_2, TEST_PIN_3, WRONG_PIN } from "../fixtures";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const circleInput = {
  setupFor: "SELF" as const,
  elderFullName: "Kamala Sharma",
  elderPreferredName: "Kamala",
  dateOfBirth: "1948-03-12",
  timezone: "Asia/Kolkata",
  conditions: "Diabetes",
  allergies: "Penicillin",
  consentMode: true,
  yourName: "",
  relationship: "",
  email: "kamala@example.com",
  pin: TEST_PIN,
  confirmPin: TEST_PIN,
};

describe("createCircle", () => {
  it("makes the elder the admin when they set it up themselves", async () => {
    const { profile, member } = await createCircle(db, circleInput);
    expect(profile.careCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(profile.consentMode).toBe(true);
    expect(member).toMatchObject({ role: "ELDER", isAdmin: true, email: "kamala@example.com" });
    expect(member.passcodeHash).not.toContain(TEST_PIN);
    expect(await db.activityLog.count({ where: { profileId: profile.id } })).toBe(1);
  });

  it("creates a family admin plus an elder sign-in when set up for a loved one", async () => {
    const { profile, member } = await createCircle(db, {
      ...circleInput,
      setupFor: "LOVED_ONE",
      yourName: "Rahul",
      relationship: "Son",
      email: "rahul@example.com",
      pin: TEST_PIN_2,
      confirmPin: TEST_PIN_2,
      elderPin: TEST_PIN,
    });
    expect(member).toMatchObject({ role: "FAMILY", isAdmin: true, name: "Rahul" });
    const elder = await db.member.findFirstOrThrow({ where: { profileId: profile.id, role: "ELDER" } });
    expect(elder.name).toBe("Kamala");
    expect(profile.consentMode).toBe(true);
  });

  it("switches consent off when the elder has no sign-in to give it", async () => {
    const { profile } = await createCircle(db, {
      ...circleInput,
      setupFor: "LOVED_ONE",
      yourName: "Rahul",
      pin: TEST_PIN_2,
      confirmPin: TEST_PIN_2,
    });
    expect(profile.consentMode).toBe(false);
  });
});

describe("authenticate", () => {
  it("signs in with the right PIN and locks after repeated failures", async () => {
    const { profile, member } = await createCircle(db, circleInput);
    const input = { careCode: profile.careCode, memberId: member.id };
    const t0 = utc("2026-03-10T10:00:00");

    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      const r = await authenticate(db, { ...input, pin: WRONG_PIN }, t0);
      expect(r).toEqual({ ok: false, reason: "invalid", attemptsLeft: MAX_FAILED_ATTEMPTS - i });
    }
    const locked = await authenticate(db, { ...input, pin: WRONG_PIN }, t0);
    expect(locked).toMatchObject({ ok: false, reason: "locked" });

    // Even the right PIN is refused while locked…
    expect(await authenticate(db, { ...input, pin: TEST_PIN }, t0)).toMatchObject({ reason: "locked" });
    // …and accepted once the lock expires.
    const later = new Date(t0.getTime() + (LOCKOUT_MINUTES + 1) * 60_000);
    expect(await authenticate(db, { ...input, pin: TEST_PIN }, later)).toEqual({ ok: true, memberId: member.id });
    expect((await db.member.findUniqueOrThrow({ where: { id: member.id } })).failedAttempts).toBe(0);
    expect(await db.activityLog.count({ where: { action: "security.lockout" } })).toBe(1);
  });

  it("does not reveal whether a member exists in another circle", async () => {
    const a = await createCircle(db, circleInput);
    const b = await createCircle(db, circleInput);
    const r = await authenticate(db, { careCode: b.profile.careCode, memberId: a.member.id, pin: TEST_PIN });
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("invites", () => {
  const join = (inviteCode: string) => ({
    inviteCode,
    name: "Anita",
    relationship: "Daughter",
    email: "anita@example.com",
    pin: TEST_PIN_3,
    confirmPin: TEST_PIN_3,
  });

  it("stores only a hash and can be redeemed exactly once", async () => {
    const { profile, elder } = await makeCircle();
    const { code } = await createInvite(db, {
      profileId: profile.id,
      role: "FAMILY",
      label: "Anita",
      createdById: elder.id,
    });
    const stored = await db.invite.findFirstOrThrow();
    expect(stored.codeHash).toBe(sha256(code));
    expect(JSON.stringify(stored)).not.toContain(code);

    const first = await redeemInvite(db, join(code));
    expect(first.ok).toBe(true);
    const member = await db.member.findFirstOrThrow({ where: { name: "Anita" } });
    expect(member).toMatchObject({ role: "FAMILY", profileId: profile.id, emailDailyDigest: true });

    const second = await redeemInvite(db, join(code));
    expect(second).toMatchObject({ ok: false });
  });

  it("rejects expired and revoked invites", async () => {
    const { profile, elder } = await makeCircle();
    const now = utc("2026-03-10T10:00:00");
    const expired = await createInvite(
      db,
      { profileId: profile.id, role: "CARETAKER", label: "", createdById: elder.id },
      now,
    );
    expect((await redeemInvite(db, join(expired.code), new Date(now.getTime() + 73 * 3_600_000))).ok).toBe(false);

    const revoked = await createInvite(db, {
      profileId: profile.id,
      role: "CARETAKER",
      label: "",
      createdById: elder.id,
    });
    await db.invite.updateMany({ where: { codeHash: sha256(revoked.code) }, data: { revokedAt: new Date() } });
    expect((await redeemInvite(db, join(revoked.code))).ok).toBe(false);
  });
});

describe("dose logging", () => {
  const now = utc("2026-03-10T08:10:00");
  const base = (profileId: string, medicationId: string, actorId: string) => ({
    profileId,
    medicationId,
    actorId,
    timezone: "UTC",
    note: "",
  });

  it("rejects instants that aren't on the schedule, or are too far ahead", async () => {
    const { profile, elder } = await makeCircle();
    const med = await addMed(profile.id);
    expect(
      await recordDose(
        db,
        { ...base(profile.id, med.id, elder.id), scheduledFor: utc("2026-03-10T08:05:00"), status: "TAKEN" },
        now,
      ),
    ).toEqual({ ok: false, error: "not-scheduled" });
    expect(
      await recordDose(
        db,
        { ...base(profile.id, med.id, elder.id), scheduledFor: utc("2026-03-12T08:00:00"), status: "TAKEN" },
        now,
      ),
    ).toEqual({ ok: false, error: "too-early" });
    expect(
      await recordDose(
        db,
        { ...base(profile.id, "other", elder.id), scheduledFor: utc("2026-03-10T08:00:00"), status: "TAKEN" },
        now,
      ),
    ).toEqual({ ok: false, error: "not-found" });
  });

  it("keeps stock in step with taken, skipped and undone doses", async () => {
    const { profile, elder } = await makeCircle();
    const med = await addMed(profile.id, { stockCount: 10 });
    const input = { ...base(profile.id, med.id, elder.id), scheduledFor: utc("2026-03-10T08:00:00") };
    const stock = async () => (await db.medication.findUniqueOrThrow({ where: { id: med.id } })).stockCount;

    await recordDose(db, { ...input, status: "TAKEN" }, now);
    expect(await stock()).toBe(9);
    await recordDose(db, { ...input, status: "TAKEN" }, now); // double tap
    expect(await stock()).toBe(9);
    await recordDose(db, { ...input, status: "SKIPPED", note: "Felt unwell" }, now);
    expect(await stock()).toBe(10);
    await recordDose(db, { ...input, status: "TAKEN" }, now);
    expect(await undoDose(db, input)).toBe(true);
    expect(await stock()).toBe(10);
    expect(await db.doseLog.count()).toBe(0);
  });

  it("lets a missed dose be corrected to taken (late)", async () => {
    const { profile, elder } = await makeCircle();
    const med = await addMed(profile.id);
    const at = utc("2026-03-10T08:00:00");
    await db.doseLog.create({
      data: { profileId: profile.id, medicationId: med.id, scheduledFor: at, status: "MISSED" },
    });
    await recordDose(
      db,
      { ...base(profile.id, med.id, elder.id), scheduledFor: at, status: "TAKEN" },
      utc("2026-03-10T11:00:00"),
    );
    expect((await db.doseLog.findFirstOrThrow()).status).toBe("TAKEN");
    expect((await db.activityLog.findFirstOrThrow({ where: { action: "dose.taken" } })).summary).toContain("(late)");
  });
});

describe("applyMedicationChange", () => {
  const input = {
    name: "Atorvastatin",
    strength: "10 mg",
    form: "TABLET" as const,
    doseQuantity: 1,
    doseUnit: "tablet",
    times: ["20:00"],
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    startDate: "2026-01-01",
    endDate: null,
    foodTiming: "WITH_FOOD" as const,
    instructions: "",
    purpose: "Cholesterol",
    prescriber: "",
    appearance: "",
    pillColor: "white" as const,
    stockCount: 30,
    refillAt: 7,
  };

  it("moves the schedule's effective date only when the timing changes", async () => {
    const { profile, elder } = await makeCircle();
    const med = await addMed(profile.id, { name: "Atorvastatin", times: "21:00" });
    const before = med.scheduleChangedAt;

    const renamed = await applyMedicationChange(db, {
      kind: "UPDATE",
      profileId: profile.id,
      medicationId: med.id,
      input: { ...input, times: ["21:00"], purpose: "Heart" },
      actorId: elder.id,
    });
    expect(renamed.scheduleChangedAt.getTime()).toBe(before.getTime());

    const moved = await applyMedicationChange(db, {
      kind: "UPDATE",
      profileId: profile.id,
      medicationId: med.id,
      input,
      actorId: elder.id,
    });
    expect(moved.times).toBe("20:00");
    expect(moved.scheduleChangedAt.getTime()).toBeGreaterThan(before.getTime());
    expect(
      (
        await db.activityLog.findFirstOrThrow({
          where: { action: "medication.updated" },
          orderBy: { createdAt: "desc" },
        })
      ).summary,
    ).toContain("times → 8:00 PM");
  });

  it("refuses to touch medicines from another circle", async () => {
    const a = await makeCircle();
    const b = await makeCircle();
    const med = await addMed(a.profile.id);
    await expect(
      applyMedicationChange(db, {
        kind: "ARCHIVE",
        profileId: b.profile.id,
        medicationId: med.id,
        input: null,
        actorId: b.elder.id,
      }),
    ).rejects.toThrow("not found");
  });
});

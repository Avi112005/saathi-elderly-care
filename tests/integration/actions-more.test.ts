/** More server-action coverage: circle management, sign-up/join, appointments, settings, routines, stock. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateToken, hashPasscode, sha256 } from "@/lib/server/crypto";
import { db, makeCircle, resetDb } from "./helpers";
import { TEST_PIN, TEST_PIN_2, TEST_PIN_3 } from "../fixtures";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250)}` }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`redirect:${url}`), { url });
  },
}));

const circleActions = await import("@/app/actions/circle");
const authActions = await import("@/app/actions/auth");
const apptActions = await import("@/app/actions/appointments");
const settingsActions = await import("@/app/actions/settings");
const routineActions = await import("@/app/actions/routines");
const medActions = await import("@/app/actions/medications");
const { SESSION_COOKIE } = await import("@/lib/server/session");
const { IDLE } = await import("@/lib/actions");

async function signInAs(memberId: string) {
  const token = generateToken();
  await db.session.create({ data: { tokenHash: sha256(token), memberId, expiresAt: new Date(Date.now() + 86_400_000) } });
  jar.set(SESSION_COOKIE, token);
}
const form = (fields: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  return fd;
};

beforeEach(async () => {
  jar.clear();
  await resetDb();
});
afterAll(() => db.$disconnect());

describe("circle management", () => {
  it("invites, joins with the code, and manages the new member", async () => {
    const { profile, elder } = await makeCircle();
    await signInAs(elder.id);
    const invite = await circleActions.inviteMember(IDLE, form({ role: "CARETAKER", label: "Anita" }));
    expect(invite).toMatchObject({ status: "success", data: { code: expect.stringMatching(/^JOIN-/), careCode: profile.careCode } });

    jar.clear();
    await expect(
      authActions.joinCircle(IDLE, form({ inviteCode: invite.data!.code!, name: "Anita", relationship: "Nurse", email: "anita@example.com", pin: TEST_PIN, confirmPin: TEST_PIN })),
    ).rejects.toMatchObject({ url: "/app" });
    const anita = await db.member.findFirstOrThrow({ where: { name: "Anita" } });
    expect(anita.role).toBe("CARETAKER");

    jar.clear();
    await signInAs(elder.id);
    expect(await circleActions.updateMemberAccess(IDLE, form({ id: anita.id, intent: "role", role: "FAMILY" }))).toMatchObject({ status: "success" });
    await db.member.update({ where: { id: anita.id }, data: { lockedUntil: new Date(Date.now() + 600_000) } });
    expect(await circleActions.updateMemberAccess(IDLE, form({ id: anita.id, intent: "unlock" }))).toMatchObject({ status: "success" });
    expect(await circleActions.updateMemberAccess(IDLE, form({ id: anita.id, intent: "remove" }))).toMatchObject({ status: "success" });
    expect((await db.member.findUniqueOrThrow({ where: { id: anita.id } })).active).toBe(false);
    expect(await db.session.count({ where: { memberId: anita.id } })).toBe(0);
  });

  it("never lets anyone remove the elder", async () => {
    const { profile, elder, family } = await makeCircle();
    await db.member.update({ where: { id: family.id }, data: { isAdmin: true } });
    await signInAs(family.id);
    expect(await circleActions.updateMemberAccess(IDLE, form({ id: elder.id, intent: "remove" }))).toMatchObject({ status: "error" });
    expect(await db.member.count({ where: { profileId: profile.id, active: true } })).toBe(3);
  });

  it("revokes unused invites", async () => {
    const { elder } = await makeCircle();
    await signInAs(elder.id);
    await circleActions.inviteMember(IDLE, form({ role: "FAMILY", label: "" }));
    const invite = await db.invite.findFirstOrThrow();
    expect(await circleActions.revokeInvite(IDLE, form({ id: invite.id }))).toMatchObject({ status: "success" });
    expect(await circleActions.revokeInvite(IDLE, form({ id: invite.id }))).toMatchObject({ status: "error" });
  });

  it("lets only the elder switch consent mode off", async () => {
    const { profile, elder, family } = await makeCircle({ consentMode: true });
    await db.member.update({ where: { id: family.id }, data: { isAdmin: true } });
    await signInAs(family.id);
    expect(await circleActions.setConsentMode(IDLE, form({ enable: "false" }))).toMatchObject({ status: "error" });
    jar.clear();
    await signInAs(elder.id);
    expect(await circleActions.setConsentMode(IDLE, form({ enable: "false" }))).toMatchObject({ status: "success" });
    expect((await db.careProfile.findUniqueOrThrow({ where: { id: profile.id } })).consentMode).toBe(false);
  });
});

describe("creating and finding a circle", () => {
  it("creates a circle and signs the creator in", async () => {
    const res = authActions.startCircle(
      IDLE,
      form({ setupFor: "SELF", elderFullName: "Meera Iyer", elderPreferredName: "Meera", dateOfBirth: "1950-05-05", timezone: "Asia/Kolkata", conditions: "", allergies: "", email: "", pin: TEST_PIN_3, confirmPin: TEST_PIN_3, consentMode: "on" }),
    );
    await expect(res).rejects.toMatchObject({ url: expect.stringMatching(/^\/app\/welcome\?code=/) });
    expect(jar.get(SESSION_COOKIE)).toBeTruthy();
    expect(await db.member.count({ where: { name: "Meera", role: "ELDER" } })).toBe(1);
  });

  it("looks up a care code and rejects unknown ones", async () => {
    const { profile } = await makeCircle();
    await expect(authActions.findCircle(IDLE, form({ careCode: profile.careCode.toLowerCase() }))).rejects.toMatchObject({ url: `/access/${profile.careCode}` });
    expect(await authActions.findCircle(IDLE, form({ careCode: "ZZZZ-ZZZZ" }))).toMatchObject({ status: "error" });
  });
});

describe("appointments", () => {
  it("books, annotates and closes an appointment", async () => {
    const { profile, family } = await makeCircle();
    await signInAs(family.id);
    await expect(
      apptActions.saveAppointment(IDLE, form({ title: "Cardiology", doctorName: "Dr. Mehta", specialty: "", location: "", date: "2026-12-01", time: "11:00", durationMin: "30", notes: "", questions: "", transport: "" })),
    ).rejects.toMatchObject({ url: "/app/appointments?saved=1" });
    const appt = await db.appointment.findFirstOrThrow({ where: { profileId: profile.id } });
    expect(appt.startsAt.toISOString()).toBe("2026-12-01T11:00:00.000Z");
    expect(await apptActions.addQuestion(IDLE, form({ id: appt.id, question: "Can I reduce the sleeping tablet?" }))).toMatchObject({ status: "success" });
    expect(await apptActions.addQuestion(IDLE, form({ id: appt.id, question: "x" }))).toMatchObject({ status: "error" });
    expect(await apptActions.recordOutcome(IDLE, form({ id: appt.id, status: "COMPLETED", outcome: "All fine" }))).toMatchObject({ status: "success" });
    expect(await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })).toMatchObject({ status: "COMPLETED", questions: "Can I reduce the sleeping tablet?" });
  });
});

describe("settings", () => {
  it("saves notification preferences (unticked boxes become false)", async () => {
    const { caretaker } = await makeCircle();
    await signInAs(caretaker.id);
    const res = await settingsActions.updateMySettings(IDLE, form({ name: "Priya", relationship: "Nurse", email: "Priya@Example.com", emailAppointments: "on", quietStart: "22:00", quietEnd: "07:00" }));
    expect(res).toMatchObject({ status: "success" });
    expect(await db.member.findUniqueOrThrow({ where: { id: caretaker.id } })).toMatchObject({
      email: "priya@example.com",
      emailAppointments: true,
      emailDoseReminders: false,
      emailVitalAlerts: false,
      quietStart: "22:00",
    });
  });

  it("updates the health profile only for admins, with a valid escalation ladder", async () => {
    const { profile, elder, caretaker } = await makeCircle();
    const fields = { fullName: "Kamala Sharma", preferredName: "Kamala", dateOfBirth: "1948-03-12", timezone: "Asia/Kolkata", conditions: "", allergies: "Sulfa", bloodGroup: "B+", emergencyContact: "", primaryDoctor: "", notes: "", reminderLeadMin: "10", nudgeAfterMin: "20", escalateAfterMin: "90" };
    await signInAs(caretaker.id);
    expect(await settingsActions.updateProfile(IDLE, form(fields))).toMatchObject({ status: "error" });
    jar.clear();
    await signInAs(elder.id);
    expect(await settingsActions.updateProfile(IDLE, form({ ...fields, escalateAfterMin: "15" }))).toMatchObject({ status: "error", fieldErrors: { escalateAfterMin: expect.any(Array) } });
    expect(await settingsActions.updateProfile(IDLE, form(fields))).toMatchObject({ status: "success" });
    expect(await db.careProfile.findUniqueOrThrow({ where: { id: profile.id } })).toMatchObject({ allergies: "Sulfa", timezone: "Asia/Kolkata", escalateAfterMin: 90 });
  });

  it("sends a test email to the outbox and runs the reminder check on demand", async () => {
    const { elder } = await makeCircle();
    await signInAs(elder.id);
    expect(await settingsActions.sendTestEmail(IDLE)).toMatchObject({ status: "success" });
    expect(await db.notification.count({ where: { kind: "TEST" } })).toBe(1);
    expect(await settingsActions.runRemindersNow(IDLE)).toMatchObject({ status: "success", message: expect.stringMatching(/^Checked/) });
  });

  it("deletes a circle only after typing the name, and refuses a wrong current PIN", async () => {
    const { profile, elder } = await makeCircle();
    await db.member.update({ where: { id: elder.id }, data: { passcodeHash: await hashPasscode(TEST_PIN) } });
    await signInAs(elder.id);
    expect(await settingsActions.changePin(IDLE, form({ currentPin: TEST_PIN_2, pin: TEST_PIN_3, confirmPin: TEST_PIN_3 }))).toMatchObject({ status: "error" });
    expect(await settingsActions.deleteCircle(IDLE, form({ confirm: "kamala" }))).toMatchObject({ status: "error" });
    await expect(settingsActions.deleteCircle(IDLE, form({ confirm: "Kamala" }))).rejects.toMatchObject({ url: "/?deleted=1" });
    expect(await db.careProfile.count({ where: { id: profile.id } })).toBe(0);
  });
});

describe("routines and stock", () => {
  it("creates and stops a routine through the actions", async () => {
    const { profile, family } = await makeCircle();
    await signInAs(family.id);
    await expect(
      routineActions.saveRoutineAction(IDLE, form({ title: "Evening walk", kind: "ACTIVITY", times: ["18:00"], daysOfWeek: ["1", "2"], startDate: "2026-03-01", endDate: "", notes: "" })),
    ).rejects.toMatchObject({ url: "/app/routines?saved=1" });
    const routine = await db.routine.findFirstOrThrow({ where: { profileId: profile.id } });
    expect(await routineActions.stopRoutineAction(IDLE, form({ id: routine.id }))).toMatchObject({ status: "success" });
  });

  it("adds stock after a refill and logs then undoes a dose", async () => {
    const { profile, elder } = await makeCircle();
    const now = new Date();
    const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    const med = await db.medication.create({ data: { profileId: profile.id, name: "Metformin", times: hhmm, startDate: "2026-01-01", stockCount: 2 } });
    const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes())).toISOString();
    await signInAs(elder.id);
    expect(await medActions.addStock(IDLE, form({ id: med.id, amount: "30" }))).toMatchObject({ status: "success" });
    expect(await medActions.addStock(IDLE, form({ id: med.id, amount: "-4" }))).toMatchObject({ status: "error" });
    expect(await medActions.logDose(IDLE, form({ medicationId: med.id, scheduledFor: at, status: "TAKEN" }))).toMatchObject({ status: "success" });
    expect((await db.medication.findUniqueOrThrow({ where: { id: med.id } })).stockCount).toBe(31);
    expect(await medActions.undoDoseAction(IDLE, form({ medicationId: med.id, scheduledFor: at }))).toMatchObject({ status: "success" });
    expect((await db.medication.findUniqueOrThrow({ where: { id: med.id } })).stockCount).toBe(32);
  });
});

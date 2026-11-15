import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { recordRoutine, saveRoutine, stopRoutine, undoRoutine } from "@/lib/server/routine-service";
import { purgeExpired } from "@/lib/server/housekeeping";
import { runReminderSweep } from "@/lib/server/reminders";
import { db, fakeMailer, makeCircle, resetDb, utc } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function bpRoutine(profileId: string) {
  return db.routine.create({
    data: {
      profileId,
      title: "Check blood pressure",
      kind: "BLOOD_PRESSURE",
      times: "08:30",
      startDate: "2026-01-01",
      scheduleChangedAt: utc("2026-03-10T00:00:00"),
    },
  });
}

const now = utc("2026-03-10T08:40:00");
const at = utc("2026-03-10T08:30:00");

function record(
  circle: Awaited<ReturnType<typeof makeCircle>>,
  routineId: string,
  input: Partial<Parameters<typeof recordRoutine>[2]["input"]>,
  mailer = fakeMailer(),
) {
  return recordRoutine(
    db,
    mailer,
    {
      profileId: circle.profile.id,
      timezone: "UTC",
      elderName: "Kamala",
      actorId: circle.elder.id,
      actorName: "Kamala",
      appUrl: "http://localhost:3000",
      input: {
        routineId,
        scheduledFor: at,
        status: "DONE",
        systolic: null,
        diastolic: null,
        value: null,
        note: "",
        ...input,
      },
    },
    now,
  );
}

describe("recordRoutine", () => {
  it("stores a normal reading quietly", async () => {
    const circle = await makeCircle();
    const r = await bpRoutine(circle.profile.id);
    const mailer = fakeMailer();
    const res = await record(circle, r.id, { systolic: 122, diastolic: 78 }, mailer);
    expect(res).toMatchObject({ ok: true, flag: "NORMAL", alerted: 0 });
    expect(mailer.send).not.toHaveBeenCalled();
    expect(await db.routineLog.findFirstOrThrow()).toMatchObject({
      systolic: 122,
      diastolic: 78,
      flag: "NORMAL",
      status: "DONE",
    });
  });

  it("emails the elder and caretaker (not family) about a high reading", async () => {
    const circle = await makeCircle();
    const r = await bpRoutine(circle.profile.id);
    const res = await record(circle, r.id, { systolic: 150, diastolic: 95 });
    expect(res).toMatchObject({ ok: true, flag: "HIGH", alerted: 2 });
    const to = (await db.notification.findMany({ where: { kind: "VITAL_ALERT" }, orderBy: { toEmail: "asc" } })).map(
      (n) => n.toEmail,
    );
    expect(to).toEqual(["kamala@example.com", "priya@example.com"]);
  });

  it("emails the whole circle about an urgent reading, once", async () => {
    const circle = await makeCircle();
    const r = await bpRoutine(circle.profile.id);
    await record(circle, r.id, { systolic: 186, diastolic: 122 });
    await record(circle, r.id, { systolic: 186, diastolic: 122 }); // double submit
    const alerts = await db.notification.findMany({ where: { kind: "VITAL_ALERT" } });
    expect(alerts).toHaveLength(3);
    expect(alerts[0]!.subject).toMatch(/^Urgent reading/);
  });

  it("respects a member's choice not to get reading alerts", async () => {
    const circle = await makeCircle();
    await db.member.update({ where: { id: circle.caretaker.id }, data: { emailVitalAlerts: false } });
    const r = await bpRoutine(circle.profile.id);
    expect(await record(circle, r.id, { systolic: 150, diastolic: 95 })).toMatchObject({ alerted: 1 });
  });

  it("rejects off-schedule times, missing readings and other circles' routines", async () => {
    const circle = await makeCircle();
    const other = await makeCircle();
    const r = await bpRoutine(circle.profile.id);
    expect(
      await record(circle, r.id, { scheduledFor: utc("2026-03-10T09:00:00"), systolic: 120, diastolic: 80 }),
    ).toMatchObject({ ok: false });
    expect(await record(circle, r.id, {})).toMatchObject({ ok: false, error: "Enter both blood-pressure numbers" });
    const foreign = await bpRoutine(other.profile.id);
    expect(await record(circle, foreign.id, { systolic: 120, diastolic: 80 })).toMatchObject({ ok: false });
  });

  it("lets a routine be skipped without a reading, then undone", async () => {
    const circle = await makeCircle();
    const r = await bpRoutine(circle.profile.id);
    expect(await record(circle, r.id, { status: "SKIPPED" })).toMatchObject({ ok: true, flag: "NORMAL" });
    expect(
      await undoRoutine(db, {
        profileId: circle.profile.id,
        actorId: circle.elder.id,
        routineId: r.id,
        scheduledFor: at,
      }),
    ).toBe(true);
    expect(await db.routineLog.count()).toBe(0);
  });
});

describe("saveRoutine / stopRoutine", () => {
  const input = {
    title: "Evening walk",
    kind: "ACTIVITY" as const,
    times: ["18:00"],
    daysOfWeek: [1, 2, 3, 4, 5],
    startDate: "2026-03-01",
    endDate: null,
    notes: "",
  };

  it("creates, reschedules and stops a routine with an audit trail", async () => {
    const { profile, elder } = await makeCircle();
    const created = await saveRoutine(db, { profileId: profile.id, actorId: elder.id, routineId: null, input });
    expect(created).toMatchObject({ times: "18:00", daysOfWeek: "1,2,3,4,5" });
    const moved = await saveRoutine(db, {
      profileId: profile.id,
      actorId: elder.id,
      routineId: created.id,
      input: { ...input, times: ["17:30"] },
    });
    expect(moved.scheduleChangedAt.getTime()).toBeGreaterThan(created.scheduleChangedAt.getTime() - 1);
    expect(await stopRoutine(db, { profileId: profile.id, actorId: elder.id, routineId: created.id })).toBe(true);
    expect(await stopRoutine(db, { profileId: profile.id, actorId: elder.id, routineId: created.id })).toBe(false);
    expect(await db.activityLog.count({ where: { action: { startsWith: "routine." } } })).toBe(3);
  });
});

describe("reminder engine — routines", () => {
  it("sends a routine reminder to the elder and caretaker, and shows readings in the digest", async () => {
    const circle = await makeCircle();
    const r = await bpRoutine(circle.profile.id);
    await runReminderSweep({ db, mailer: fakeMailer(), now: utc("2026-03-10T08:20:00") });
    const reminders = (
      await db.notification.findMany({ where: { kind: "ROUTINE_UPCOMING" }, orderBy: { toEmail: "asc" } })
    ).map((n) => n.toEmail);
    expect(reminders).toEqual(["kamala@example.com", "priya@example.com"]);

    await db.routineLog.create({
      data: {
        profileId: circle.profile.id,
        routineId: r.id,
        scheduledFor: at,
        status: "DONE",
        systolic: 150,
        diastolic: 95,
        flag: "HIGH",
      },
    });
    await runReminderSweep({ db, mailer: fakeMailer(), now: utc("2026-03-10T20:05:00") });
    const digest = await db.notification.findFirstOrThrow({ where: { kind: "DAILY_DIGEST" } });
    expect(digest.bodyText).toContain("Blood pressure check 150/95 mmHg (high)");
  });
});

describe("purgeExpired", () => {
  it("removes expired sessions, dead invites and old outbox rows only", async () => {
    const { profile, elder } = await makeCircle();
    const t = utc("2026-03-10T00:00:00");
    const day = 86_400_000;
    await db.session.createMany({
      data: [
        { tokenHash: "expired", memberId: elder.id, expiresAt: new Date(t.getTime() - day) },
        { tokenHash: "live", memberId: elder.id, expiresAt: new Date(t.getTime() + day) },
      ],
    });
    await db.invite.createMany({
      data: [
        {
          profileId: profile.id,
          codeHash: "used",
          role: "FAMILY",
          createdById: elder.id,
          expiresAt: new Date(t.getTime() + day),
          usedAt: t,
        },
        {
          profileId: profile.id,
          codeHash: "open",
          role: "FAMILY",
          createdById: elder.id,
          expiresAt: new Date(t.getTime() + day),
        },
      ],
    });
    await db.notification.create({
      data: {
        profileId: profile.id,
        toEmail: "x@example.com",
        kind: "TEST",
        subject: "s",
        bodyText: "t",
        bodyHtml: "h",
        dedupeKey: "old",
        createdAt: new Date(t.getTime() - 200 * day),
      },
    });
    expect(await purgeExpired(db, t)).toEqual({ sessions: 1, invites: 1, notifications: 1 });
    expect((await db.session.findMany()).map((s) => s.tokenHash)).toEqual(["live"]);
    expect((await db.invite.findMany()).map((i) => i.codeHash)).toEqual(["open"]);
  });
});

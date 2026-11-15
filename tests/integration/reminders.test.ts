import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runReminderSweep } from "@/lib/server/reminders";
import { addMed, db, fakeMailer, makeCircle, resetDb, utc } from "./helpers";

const sweep = (now: string, mailer = fakeMailer()) => runReminderSweep({ db, mailer, now: utc(now) });
const sentTo = async (kind: string) =>
  (await db.notification.findMany({ where: { kind }, orderBy: { toEmail: "asc" } })).map((n) => n.toEmail);

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("reminder engine — doses", () => {
  it("sends an upcoming-dose reminder to opted-in members only", async () => {
    const { profile } = await makeCircle();
    await addMed(profile.id);
    const mailer = fakeMailer();
    const r = await sweep("2026-03-10T07:50:00", mailer);
    expect(r.emails.SENT).toBe(2);
    expect(await sentTo("DOSE_UPCOMING")).toEqual(["kamala@example.com", "priya@example.com"]);
    expect(mailer.send).toHaveBeenCalledTimes(2);
    expect(mailer.send.mock.calls[0]![0].subject).toMatch(/8:00 AM/);
  });

  it("is idempotent — running again sends nothing new", async () => {
    const { profile } = await makeCircle();
    await addMed(profile.id);
    await sweep("2026-03-10T07:50:00");
    const mailer = fakeMailer();
    const second = await sweep("2026-03-10T07:55:00", mailer);
    expect(second.emails.SENT).toBe(0);
    expect(second.emails.DUPLICATE).toBe(2);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(await db.notification.count()).toBe(2);
  });

  it("nudges the elder and caretaker (not family) after 30 minutes", async () => {
    const { profile } = await makeCircle();
    await addMed(profile.id);
    await sweep("2026-03-10T08:35:00");
    expect(await sentTo("DOSE_NUDGE")).toEqual(["kamala@example.com", "priya@example.com"]);
  });

  it("marks the dose missed and tells the whole circle after 2 hours", async () => {
    const { profile } = await makeCircle();
    const med = await addMed(profile.id);
    const r = await sweep("2026-03-10T10:05:00");
    expect(r.markedMissed).toBe(1);
    const log = await db.doseLog.findFirstOrThrow({ where: { medicationId: med.id } });
    expect(log).toMatchObject({ status: "MISSED", loggedById: null });
    expect(await sentTo("DOSE_MISSED")).toEqual(["kamala@example.com", "priya@example.com", "rahul@example.com"]);
    // A later sweep doesn't re-mark or re-send.
    const again = await sweep("2026-03-10T10:30:00");
    expect(again.markedMissed).toBe(0);
    expect(again.emails.SENT).toBe(0);
  });

  it("stays quiet about doses that were logged", async () => {
    const { profile, elder } = await makeCircle();
    const med = await addMed(profile.id);
    await db.doseLog.create({ data: { profileId: profile.id, medicationId: med.id, scheduledFor: utc("2026-03-10T08:00:00"), status: "TAKEN", loggedById: elder.id } });
    const r = await sweep("2026-03-10T10:05:00");
    expect(r.emails.SENT + r.markedMissed).toBe(0);
  });

  it("ignores doses from before a medicine (or its schedule) existed", async () => {
    const { profile } = await makeCircle();
    await addMed(profile.id, { createdAt: utc("2026-03-10T09:00:00"), scheduleChangedAt: utc("2026-03-10T09:00:00") });
    const r = await sweep("2026-03-10T10:05:00");
    expect(r.markedMissed).toBe(0);
    expect(await db.notification.count()).toBe(0);
  });

  it("groups medicines due at the same time into one email per person", async () => {
    const { profile } = await makeCircle();
    await addMed(profile.id, { name: "Metformin" });
    await addMed(profile.id, { name: "Amlodipine" });
    const mailer = fakeMailer();
    await sweep("2026-03-10T07:50:00", mailer);
    expect(mailer.send).toHaveBeenCalledTimes(2);
    const text = mailer.send.mock.calls[0]![0].text as string;
    expect(text).toContain("Metformin 500 mg");
    expect(text).toContain("Amlodipine 500 mg");
  });

  it("holds non-urgent reminders during quiet hours", async () => {
    const { profile, caretaker } = await makeCircle();
    await db.member.update({ where: { id: caretaker.id }, data: { quietStart: "22:00", quietEnd: "08:00" } });
    await addMed(profile.id);
    await sweep("2026-03-10T07:50:00");
    expect(await sentTo("DOSE_UPCOMING")).toEqual(["kamala@example.com"]);
  });

  it("records delivery failures without crashing the sweep", async () => {
    const { profile } = await makeCircle();
    await addMed(profile.id);
    const mailer = fakeMailer();
    mailer.send.mockRejectedValue(new Error("SMTP 550 mailbox unavailable"));
    const r = await sweep("2026-03-10T07:50:00", mailer);
    expect(r.emails.FAILED).toBe(2);
    const failed = await db.notification.findFirstOrThrow();
    expect(failed.status).toBe("FAILED");
    expect(failed.error).toContain("550");
  });

  it("writes to the outbox without sending when SMTP is not configured", async () => {
    const { profile } = await makeCircle();
    await addMed(profile.id);
    const r = await sweep("2026-03-10T07:50:00", fakeMailer(false));
    expect(r.emails.LOGGED).toBe(2);
  });
});

describe("reminder engine — appointments, refills, digest", () => {
  it("reminds everyone the day before and again two hours before", async () => {
    const { profile } = await makeCircle();
    await db.appointment.create({ data: { profileId: profile.id, title: "Cardiology", startsAt: utc("2026-03-11T11:00:00"), questions: "Ask about BP" } });
    await sweep("2026-03-10T12:00:00");
    expect(await sentTo("APPOINTMENT")).toHaveLength(3);
    await sweep("2026-03-11T09:30:00");
    expect(await db.notification.count({ where: { kind: "APPOINTMENT" } })).toBe(6);
    await sweep("2026-03-11T10:00:00");
    expect(await db.notification.count({ where: { kind: "APPOINTMENT" } })).toBe(6);
  });

  it("sends a refill reminder at most once a week", async () => {
    const { profile } = await makeCircle();
    await addMed(profile.id, { stockCount: 3, times: "08:00,20:00" });
    await sweep("2026-03-10T12:00:00");
    expect(await sentTo("REFILL")).toHaveLength(3);
    await sweep("2026-03-11T12:00:00");
    expect(await db.notification.count({ where: { kind: "REFILL" } })).toBe(3);
  });

  it("sends the evening digest to members who asked for it", async () => {
    const { profile, elder } = await makeCircle();
    const med = await addMed(profile.id, { times: "08:00,13:00" });
    await db.doseLog.create({ data: { profileId: profile.id, medicationId: med.id, scheduledFor: utc("2026-03-10T08:00:00"), status: "TAKEN", loggedById: elder.id } });
    await sweep("2026-03-10T19:59:00");
    expect(await sentTo("DAILY_DIGEST")).toEqual([]);
    await sweep("2026-03-10T20:01:00");
    expect(await sentTo("DAILY_DIGEST")).toEqual(["rahul@example.com"]);
    const digest = await db.notification.findFirstOrThrow({ where: { kind: "DAILY_DIGEST" } });
    expect(digest.subject).toBe("Kamala's day — 1/2 doses taken");
  });
});

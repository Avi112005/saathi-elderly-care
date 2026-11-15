import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getAdherenceView, getTodayView, getVitalsView, safetyFindings } from "@/lib/server/queries";
import { db, makeCircle, resetDb, utc } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("getTodayView", () => {
  it("combines doses, routines, refills, requests and safety findings for the day", async () => {
    const { profile, elder, caretaker } = await makeCircle();
    const since = utc("2026-03-01T00:00:00");
    const warfarin = await db.medication.create({ data: { profileId: profile.id, name: "Warfarin", times: "08:00,20:00", startDate: "2026-03-01", stockCount: 4, scheduleChangedAt: since } });
    await db.medication.create({ data: { profileId: profile.id, name: "Brufen", times: "13:00", startDate: "2026-03-01", scheduleChangedAt: since } });
    await db.doseLog.create({ data: { profileId: profile.id, medicationId: warfarin.id, scheduledFor: utc("2026-03-10T08:00:00"), status: "TAKEN", loggedById: caretaker.id } });
    const routine = await db.routine.create({ data: { profileId: profile.id, title: "Check blood pressure", kind: "BLOOD_PRESSURE", times: "09:00", startDate: "2026-03-01", scheduleChangedAt: since } });
    await db.routineLog.create({ data: { profileId: profile.id, routineId: routine.id, scheduledFor: utc("2026-03-10T09:00:00"), status: "DONE", systolic: 150, diastolic: 95, flag: "HIGH", loggedById: elder.id } });
    await db.changeRequest.create({ data: { profileId: profile.id, kind: "ARCHIVE", medicationId: warfarin.id, payload: "null", summary: "stop Warfarin", requestedById: caretaker.id } });

    const view = await getTodayView(profile.id, utc("2026-03-10T14:00:00"));
    expect(view.doses.map((d) => `${d.med.name}@${d.localTime}:${d.state}`)).toEqual(["Warfarin@08:00:TAKEN", "Brufen@13:00:OVERDUE", "Warfarin@20:00:PENDING"]);
    expect(view.doses[0]!.loggedBy).toBe("Priya");
    expect(view.summary).toMatchObject({ taken: 1, missed: 1, pending: 1 });
    expect(view.next?.med.name).toBe("Brufen");
    expect(view.routines).toEqual([expect.objectContaining({ title: "Check blood pressure", status: "DONE", flag: "HIGH", reading: { systolic: 150, diastolic: 95, value: null } })]);
    expect(view.refills.map((r) => r.med.name)).toEqual(["Warfarin"]);
    expect(view.requests).toHaveLength(1);
    expect(view.findings[0]).toMatchObject({ severity: "high", title: "Serious bleeding risk" });
  });
});

describe("getAdherenceView", () => {
  it("computes rates, per-medicine and per-time-of-day breakdowns", async () => {
    const { profile, elder } = await makeCircle();
    const since = utc("2026-03-01T00:00:00");
    const med = await db.medication.create({ data: { profileId: profile.id, name: "Metformin", times: "08:00,21:00", startDate: "2026-03-01", createdAt: since, scheduleChangedAt: since } });
    for (const day of ["08", "09"]) {
      await db.doseLog.create({ data: { profileId: profile.id, medicationId: med.id, scheduledFor: utc(`2026-03-${day}T08:00:00`), status: "TAKEN", loggedById: elder.id } });
      await db.doseLog.create({ data: { profileId: profile.id, medicationId: med.id, scheduledFor: utc(`2026-03-${day}T21:00:00`), status: "MISSED" } });
    }
    const view = await getAdherenceView(profile.id, 3, utc("2026-03-10T07:00:00"));
    expect(view.summary).toMatchObject({ taken: 2, due: 4, rate: 50 });
    expect(view.perMed).toEqual([expect.objectContaining({ name: "Metformin", summary: expect.objectContaining({ rate: 50 }) })]);
    expect(view.perPart.map((p) => [p.part, p.summary.rate])).toEqual([
      ["Morning", 100],
      ["Night", 0],
    ]);
    expect(view.activeMeds).toHaveLength(1);
  });
});

describe("getVitalsView / safetyFindings", () => {
  it("summarises readings per measurement routine and ignores activities", async () => {
    const { profile } = await makeCircle();
    const bp = await db.routine.create({ data: { profileId: profile.id, title: "BP", kind: "BLOOD_PRESSURE", times: "09:00", startDate: "2026-03-01" } });
    await db.routine.create({ data: { profileId: profile.id, title: "Walk", kind: "ACTIVITY", times: "18:00", startDate: "2026-03-01" } });
    for (const [d, s, f] of [["08", 120, "NORMAL"], ["09", 150, "HIGH"]] as const) {
      await db.routineLog.create({ data: { profileId: profile.id, routineId: bp.id, scheduledFor: utc(`2026-03-${d}T09:00:00`), status: "DONE", systolic: s, diastolic: 80, flag: f } });
    }
    const rows = await getVitalsView(profile.id, 30, utc("2026-03-10T12:00:00"));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.summary).toMatchObject({ count: 2, flagged: 1, average: { systolic: 135, diastolic: 80 } });
  });

  it("reviews already-loaded data without querying", () => {
    expect(safetyFindings({ allergies: "Penicillin", dateOfBirth: new Date("1950-01-01") }, [{ name: "Augmentin", times: "08:00" }])[0]).toMatchObject({ kind: "allergy" });
  });
});

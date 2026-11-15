import { describe, expect, it } from "vitest";
import { alertAudience, assessReading, formatReading, isMeasurement, summariseReadings } from "@/lib/domain/vitals";
import { formToObject, readingProblem, routineLogSchema, routineSchema } from "@/lib/validation/schemas";
import { sessionCookieName } from "@/lib/session-cookie";

describe("assessReading", () => {
  it.each([
    [{ systolic: 118, diastolic: 76 }, "NORMAL"],
    [{ systolic: 142, diastolic: 85 }, "HIGH"],
    [{ systolic: 130, diastolic: 92 }, "HIGH"],
    [{ systolic: 182, diastolic: 100 }, "URGENT"],
    [{ systolic: 150, diastolic: 121 }, "URGENT"],
    [{ systolic: 86, diastolic: 58 }, "LOW"],
  ])("blood pressure %o → %s", (reading, flag) => {
    expect(assessReading("BLOOD_PRESSURE", reading).flag).toBe(flag);
  });

  it.each([
    [50, "URGENT"],
    [65, "LOW"],
    [110, "NORMAL"],
    [200, "HIGH"],
    [320, "URGENT"],
  ])("blood sugar %i mg/dL → %s", (value, flag) => {
    expect(assessReading("BLOOD_SUGAR", { value }).flag).toBe(flag);
  });

  it.each([
    [35, "URGENT"],
    [45, "LOW"],
    [72, "NORMAL"],
    [110, "HIGH"],
    [140, "URGENT"],
  ])("pulse %i bpm → %s", (value, flag) => {
    expect(assessReading("PULSE", { value }).flag).toBe(flag);
  });

  it("never flags activities or weight, and always explains a flag", () => {
    expect(assessReading("ACTIVITY", {}).flag).toBe("NORMAL");
    expect(assessReading("WEIGHT", { value: 140 }).flag).toBe("NORMAL");
    expect(assessReading("BLOOD_PRESSURE", { systolic: 190, diastolic: 125 }).message).toMatch(/contact a doctor/);
  });
});

describe("reading helpers", () => {
  it("formats readings with units", () => {
    expect(formatReading("BLOOD_PRESSURE", { systolic: 142, diastolic: 91 })).toBe("142/91 mmHg");
    expect(formatReading("BLOOD_SUGAR", { value: 110 })).toBe("110 mg/dL");
    expect(formatReading("WEIGHT", { value: 61.5 })).toBe("61.5 kg");
    expect(formatReading("ACTIVITY", { value: 3 })).toBe("");
    expect(formatReading("BLOOD_PRESSURE", {})).toBe("");
  });

  it("knows which routines take a reading", () => {
    expect(isMeasurement("ACTIVITY")).toBe(false);
    expect(isMeasurement("WEIGHT")).toBe(true);
    expect(isMeasurement("BLOOD_PRESSURE")).toBe(true);
  });

  it("widens the audience with severity", () => {
    expect(alertAudience("NORMAL")).toBe("NONE");
    expect(alertAudience("LOW")).toBe("CARE_TEAM");
    expect(alertAudience("HIGH")).toBe("CARE_TEAM");
    expect(alertAudience("URGENT")).toBe("ALL");
  });

  it("summarises a period of readings", () => {
    const at = (d: number) => new Date(Date.UTC(2026, 2, d));
    const s = summariseReadings("BLOOD_PRESSURE", [
      { at: at(3), systolic: 150, diastolic: 95, flag: "HIGH" },
      { at: at(1), systolic: 120, diastolic: 80, flag: "NORMAL" },
      { at: at(2), systolic: 130, diastolic: 85, flag: "NORMAL" },
    ]);
    expect(s.count).toBe(3);
    expect(s.latest?.systolic).toBe(150);
    expect(s.average).toEqual({ systolic: 133, diastolic: 87 });
    expect(s.flagged).toBe(1);
    expect(summariseReadings("PULSE", []).latest).toBeNull();
  });
});

describe("routine validation", () => {
  const routine = { title: "Check blood pressure", kind: "BLOOD_PRESSURE", times: ["08:30"], daysOfWeek: ["1", "4"], startDate: "2026-03-01", endDate: "", notes: "" };

  it("accepts a routine and rejects bad kinds and dates", () => {
    expect(routineSchema.parse(routine)).toMatchObject({ kind: "BLOOD_PRESSURE", daysOfWeek: [1, 4], endDate: null });
    expect(routineSchema.safeParse({ ...routine, kind: "MAGIC" }).success).toBe(false);
    expect(routineSchema.safeParse({ ...routine, endDate: "2026-01-01" }).success).toBe(false);
  });

  it("range-checks blood-pressure inputs and requires the right reading", () => {
    const log = { routineId: "r1", scheduledFor: "2026-03-10T03:00:00.000Z", status: "DONE", systolic: "300", diastolic: "80" };
    expect(routineLogSchema.safeParse(log).success).toBe(false);
    const ok = routineLogSchema.parse({ ...log, systolic: "142" });
    expect(readingProblem("BLOOD_PRESSURE", ok)).toBeNull();
    expect(readingProblem("BLOOD_PRESSURE", { ...ok, diastolic: 150 })).toMatch(/bigger/);
    expect(readingProblem("BLOOD_PRESSURE", { ...ok, systolic: null })).toMatch(/both/);
    expect(readingProblem("BLOOD_SUGAR", { ...ok, value: null })).toMatch(/Enter the reading/);
    expect(readingProblem("PULSE", { ...ok, value: 400 })).toMatch(/looks wrong/);
    expect(readingProblem("BLOOD_SUGAR", { ...ok, status: "SKIPPED", value: null })).toBeNull();
    expect(readingProblem("ACTIVITY", { ...ok, value: null })).toBeNull();
  });
});

describe("hardening helpers", () => {
  it("never lets a form field reach Object.prototype", () => {
    const fd = new FormData();
    fd.append("__proto__", "polluted");
    fd.append("constructor", "x");
    fd.append("name", "ok");
    const obj = formToObject(fd);
    expect(Object.keys(obj)).toEqual(["name"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(obj)).toBeNull();
  });

  it("uses a __Host- session cookie in production only", () => {
    expect(sessionCookieName("production")).toBe("__Host-saathi_session");
    expect(sessionCookieName("development")).toBe("saathi_session");
  });
});

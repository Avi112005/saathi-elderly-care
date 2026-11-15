import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { byDay, currentStreak, deriveInsights, reconcileWithLogs, resolveDoses, summarise, type LoggedDose } from "@/lib/domain/adherence";
import type { DoseOccurrence } from "@/lib/domain/schedule";

const occ = (medicationId: string, iso: string, localTime = iso.slice(11, 16)): DoseOccurrence => ({
  medicationId,
  scheduledFor: new Date(`${iso}:00.000Z`),
  localTime,
  localDate: iso.slice(0, 10),
});

describe("resolveDoses + summarise", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");
  const expected = [occ("a", "2026-03-10T08:00"), occ("a", "2026-03-10T11:50"), occ("b", "2026-03-10T09:00"), occ("b", "2026-03-10T20:00"), occ("c", "2026-03-10T07:00")];
  const logs: LoggedDose[] = [
    { medicationId: "a", scheduledFor: new Date("2026-03-10T08:00:00.000Z"), status: "TAKEN" },
    { medicationId: "c", scheduledFor: new Date("2026-03-10T07:00:00.000Z"), status: "SKIPPED" },
  ];

  it("labels each dose", () => {
    const states = resolveDoses(expected, logs, now, 30).map((d) => `${d.medicationId}:${d.state}`);
    expect(states).toEqual(["a:TAKEN", "a:PENDING", "b:OVERDUE", "b:PENDING", "c:SKIPPED"]);
  });

  it("counts overdue as missed and excludes pending from the rate", () => {
    const s = summarise(resolveDoses(expected, logs, now, 30));
    expect(s).toEqual({ taken: 1, skipped: 1, missed: 1, pending: 2, due: 3, rate: 33 });
  });

  it("has no rate when nothing is due yet", () => {
    expect(summarise([]).rate).toBeNull();
  });
});

describe("byDay + currentStreak", () => {
  const now = new Date("2026-03-13T23:00:00.000Z");
  const expected = ["10", "11", "12", "13"].flatMap((d) => [occ("a", `2026-03-${d}T08:00`), occ("a", `2026-03-${d}T20:00`)]);
  const taken = (d: string, t: string): LoggedDose => ({ medicationId: "a", scheduledFor: new Date(`2026-03-${d}T${t}:00.000Z`), status: "TAKEN" });

  it("counts consecutive perfect days back from the latest", () => {
    const logs = [taken("10", "08:00"), taken("11", "08:00"), taken("11", "20:00"), taken("12", "08:00"), taken("12", "20:00"), taken("13", "08:00"), taken("13", "20:00")];
    const days = byDay(resolveDoses(expected, logs, now, 30));
    expect(days.map((d) => d.summary.rate)).toEqual([50, 100, 100, 100]);
    expect(currentStreak(days)).toBe(3);
  });

  it("ignores days with nothing due yet", () => {
    const days = byDay(resolveDoses([occ("a", "2026-03-12T08:00"), occ("a", "2026-03-14T08:00")], [taken("12", "08:00")], now, 30));
    expect(currentStreak(days)).toBe(1);
  });
});

describe("deriveInsights", () => {
  const weekdayOf = (iso: string) => DateTime.fromISO(iso).weekday;
  const names = new Map([["a", "Metformin"], ["b", "Atorvastatin"]]);

  it("asks for patience with little data", () => {
    expect(deriveInsights([], names, weekdayOf)[0]!.title).toBe("Building a picture");
  });

  it("finds the weakest time of day and medicine", () => {
    const now = new Date("2026-03-20T00:00:00.000Z");
    const days = Array.from({ length: 8 }, (_, i) => `2026-03-${String(10 + i).padStart(2, "0")}`);
    const expected = days.flatMap((d) => [occ("a", `${d}T08:00`), occ("b", `${d}T21:00`)]);
    const logs: LoggedDose[] = expected.map((o, i) => ({
      medicationId: o.medicationId,
      scheduledFor: o.scheduledFor,
      status: o.medicationId === "b" && i % 8 !== 1 ? "MISSED" : "TAKEN",
    }));
    const insights = deriveInsights(resolveDoses(expected, logs, now, 30), names, weekdayOf);
    const titles = insights.map((i) => i.title);
    expect(titles).toContain("Night doses are the hardest");
    expect(titles).toContain("Atorvastatin is often missed");
    expect(insights.some((i) => i.tone === "act")).toBe(true);
  });
});

describe("reconcileWithLogs", () => {
  const toLocal = (d: Date) => ({ localTime: d.toISOString().slice(11, 16), localDate: d.toISOString().slice(0, 10) });

  it("drops phantom doses from before a schedule change but keeps old logged doses", () => {
    // Schedule moved from 21:00 to 20:00 on the 11th at noon.
    const expected = [occ("a", "2026-03-10T20:00"), occ("a", "2026-03-11T20:00")];
    const logs = [{ medicationId: "a", scheduledFor: new Date("2026-03-10T21:00:00.000Z") }];
    const changed = new Map([["a", new Date("2026-03-11T12:00:00.000Z")]]);
    const result = reconcileWithLogs(expected, logs, changed, toLocal);
    expect(result.map((o) => o.scheduledFor.toISOString())).toEqual(["2026-03-10T21:00:00.000Z", "2026-03-11T20:00:00.000Z"]);
  });

  it("does not duplicate doses that are both scheduled and logged", () => {
    const expected = [occ("a", "2026-03-11T20:00")];
    const logs = [{ medicationId: "a", scheduledFor: new Date("2026-03-11T20:00:00.000Z") }];
    expect(reconcileWithLogs(expected, logs, new Map(), toLocal)).toHaveLength(1);
  });
});

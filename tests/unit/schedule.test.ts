import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  describeDays,
  forecastRefill,
  isScheduledInstant,
  occurrencesBetween,
  parseDays,
  parseTimes,
  scheduleFor,
} from "@/lib/domain/schedule";

const med = (over: Partial<Parameters<typeof occurrencesBetween>[0]> = {}) => ({
  id: "m1",
  times: "08:00,20:00",
  daysOfWeek: "1,2,3,4,5,6,7",
  startDate: "2026-01-01",
  endDate: null,
  active: true,
  ...over,
});

const at = (iso: string, zone = "Asia/Kolkata") => DateTime.fromISO(iso, { zone }).toJSDate();

describe("parseTimes / parseDays", () => {
  it("sorts, de-duplicates and drops invalid times", () => {
    expect(parseTimes("20:00, 08:00,08:00, 25:00, abc,7:00")).toEqual(["08:00", "20:00"]);
  });
  it("keeps only ISO weekdays 1–7", () => {
    expect(parseDays("7,1,1,0,8,x,3")).toEqual([1, 3, 7]);
  });
  it("describes common day sets in plain words", () => {
    expect(describeDays("1,2,3,4,5,6,7")).toBe("Every day");
    expect(describeDays("1,2,3,4,5")).toBe("Weekdays");
    expect(describeDays("6,7")).toBe("Weekends");
    expect(describeDays("1,3,5")).toBe("Mon, Wed, Fri");
  });
});

describe("occurrencesBetween", () => {
  it("expands a twice-daily schedule in the profile's time zone", () => {
    const list = occurrencesBetween(med(), "Asia/Kolkata", at("2026-03-10T00:00"), at("2026-03-11T00:00"));
    expect(list.map((o) => o.localTime)).toEqual(["08:00", "20:00"]);
    // 08:00 IST is 02:30 UTC.
    expect(list[0]!.scheduledFor.toISOString()).toBe("2026-03-10T02:30:00.000Z");
    expect(list[0]!.localDate).toBe("2026-03-10");
  });

  it("respects weekdays", () => {
    // 2026-03-09 is a Monday.
    const list = occurrencesBetween(
      med({ times: "09:00", daysOfWeek: "1,3" }),
      "Asia/Kolkata",
      at("2026-03-09T00:00"),
      at("2026-03-16T00:00"),
    );
    expect(list.map((o) => o.localDate)).toEqual(["2026-03-09", "2026-03-11"]);
  });

  it("respects start and end dates (inclusive)", () => {
    const list = occurrencesBetween(
      med({ times: "09:00", startDate: "2026-03-10", endDate: "2026-03-12" }),
      "Asia/Kolkata",
      at("2026-03-01T00:00"),
      at("2026-03-31T00:00"),
    );
    expect(list.map((o) => o.localDate)).toEqual(["2026-03-10", "2026-03-11", "2026-03-12"]);
  });

  it("returns nothing for inactive medicines or empty windows", () => {
    expect(
      occurrencesBetween(med({ active: false }), "UTC", at("2026-03-10T00:00", "UTC"), at("2026-03-12T00:00", "UTC")),
    ).toEqual([]);
    expect(occurrencesBetween(med(), "UTC", at("2026-03-12T00:00", "UTC"), at("2026-03-10T00:00", "UTC"))).toEqual([]);
  });

  it("keeps doses at the same local time across a DST change", () => {
    // US clocks spring forward on 2026-03-08.
    const list = occurrencesBetween(
      med({ times: "08:00" }),
      "America/New_York",
      at("2026-03-07T00:00", "America/New_York"),
      at("2026-03-09T00:00", "America/New_York"),
    );
    expect(
      list.map((o) => DateTime.fromJSDate(o.scheduledFor, { zone: "America/New_York" }).toFormat("HH:mm")),
    ).toEqual(["08:00", "08:00"]);
    expect(list[0]!.scheduledFor.toISOString()).toBe("2026-03-07T13:00:00.000Z"); // EST, UTC-5
    expect(list[1]!.scheduledFor.toISOString()).toBe("2026-03-08T12:00:00.000Z"); // EDT, UTC-4
  });

  it("is half-open: includes `from`, excludes `to`", () => {
    const from = at("2026-03-10T08:00");
    const list = occurrencesBetween(med(), "Asia/Kolkata", from, at("2026-03-10T20:00"));
    expect(list).toHaveLength(1);
    expect(list[0]!.scheduledFor.getTime()).toBe(from.getTime());
  });
});

describe("scheduleFor", () => {
  it("merges several medicines in time order", () => {
    const list = scheduleFor(
      [med({ id: "b", times: "09:00" }), med({ id: "a", times: "08:00,09:00" })],
      "UTC",
      at("2026-03-10T00:00", "UTC"),
      at("2026-03-11T00:00", "UTC"),
    );
    expect(list.map((o) => `${o.medicationId}@${o.localTime}`)).toEqual(["a@08:00", "a@09:00", "b@09:00"]);
  });
});

describe("isScheduledInstant", () => {
  it("accepts real dose instants and rejects forged ones", () => {
    expect(isScheduledInstant(med(), "Asia/Kolkata", at("2026-03-10T08:00"))).toBe(true);
    expect(isScheduledInstant(med(), "Asia/Kolkata", at("2026-03-10T08:01"))).toBe(false);
    expect(isScheduledInstant(med(), "Asia/Kolkata", at("2025-12-31T08:00"))).toBe(false); // before start
  });
});

describe("forecastRefill", () => {
  const base = { ...med(), doseQuantity: 1, refillAt: 7 };
  const now = at("2026-03-10T10:00");

  it("estimates days left from stock and daily use", () => {
    const f = forecastRefill({ ...base, stockCount: 30 }, "Asia/Kolkata", now);
    expect(f.dailyUse).toBe(2);
    expect(f.daysLeft).toBe(15);
    expect(f.runsOutOn).toBe("2026-03-25");
    expect(f.needsRefill).toBe(false);
  });

  it("flags a refill once supply drops to the threshold in days", () => {
    expect(forecastRefill({ ...base, stockCount: 14 }, "Asia/Kolkata", now).needsRefill).toBe(true);
  });

  it("accounts for partial weeks and half tablets", () => {
    const f = forecastRefill(
      { ...base, times: "08:00", daysOfWeek: "1,3,5", doseQuantity: 0.5, stockCount: 3 },
      "UTC",
      now,
    );
    expect(f.dailyUse).toBeCloseTo(0.21, 2);
    expect(f.daysLeft).toBe(14);
  });

  it("does nothing when stock is not tracked", () => {
    expect(forecastRefill({ ...base, stockCount: null }, "UTC", now)).toMatchObject({
      daysLeft: null,
      needsRefill: false,
    });
  });
});

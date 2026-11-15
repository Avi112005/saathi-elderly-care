import { DateTime } from "luxon";
import { clockToMinutes, DAY_MS, HOUR_MS, isClockTime, MINUTE_MS } from "./time";

/** The scheduling-relevant slice of a medication. */
export interface MedicationSchedule {
  id: string;
  times: string;
  daysOfWeek: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
}

export interface DoseOccurrence {
  medicationId: string;
  /** UTC instant of the dose. */
  scheduledFor: Date;
  /** Local "HH:MM" the dose was scheduled at, in the profile's zone. */
  localTime: string;
  /** Local ISO date (YYYY-MM-DD). */
  localDate: string;
}

/** "08:00, 20:00" → ["08:00", "20:00"], sorted and de-duplicated. Invalid entries are dropped. */
export function parseTimes(raw: string): string[] {
  const unique = new Set(
    raw
      .split(",")
      .map((t) => t.trim())
      .filter(isClockTime),
  );
  return [...unique].sort((a, b) => clockToMinutes(a) - clockToMinutes(b));
}

/** "1,2,3" → [1, 2, 3] (ISO weekdays, Monday = 1). Invalid entries are dropped. */
export function parseDays(raw: string): number[] {
  const unique = new Set(
    raw
      .split(",")
      .map((d) => Number(d.trim()))
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
  );
  return [...unique].sort((a, b) => a - b);
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function describeDays(raw: string): string {
  const days = parseDays(raw);
  if (days.length === 7) return "Every day";
  if (days.join(",") === "1,2,3,4,5") return "Weekdays";
  if (days.join(",") === "6,7") return "Weekends";
  return days.map((d) => WEEKDAY_SHORT[d - 1]).join(", ");
}

/**
 * Expands a medication's schedule into concrete dose instants within [from, to).
 * Times are interpreted in the profile's IANA time zone so a dose "at 8 AM" stays at
 * 8 AM local time across daylight-saving changes.
 */
export function occurrencesBetween(med: MedicationSchedule, zone: string, from: Date, to: Date): DoseOccurrence[] {
  if (!med.active || to <= from) return [];
  const times = parseTimes(med.times);
  const days = new Set(parseDays(med.daysOfWeek));
  if (times.length === 0 || days.size === 0) return [];

  const result: DoseOccurrence[] = [];
  let cursor = DateTime.fromJSDate(from, { zone }).startOf("day");
  const last = DateTime.fromJSDate(to, { zone }).endOf("day");

  while (cursor <= last) {
    const localDate = cursor.toISODate();
    const inRange =
      localDate !== null && localDate >= med.startDate && (med.endDate === null || localDate <= med.endDate);
    if (inRange && days.has(cursor.weekday)) {
      for (const time of times) {
        const minutes = clockToMinutes(time);
        const at = cursor.set({ hour: Math.floor(minutes / 60), minute: minutes % 60, second: 0, millisecond: 0 });
        const instant = at.toJSDate();
        if (instant >= from && instant < to) {
          result.push({ medicationId: med.id, scheduledFor: instant, localTime: time, localDate: localDate! });
        }
      }
    }
    cursor = cursor.plus({ days: 1 });
  }
  return result;
}

/** All doses for many medications in a window, ordered by time. */
export function scheduleFor(meds: MedicationSchedule[], zone: string, from: Date, to: Date): DoseOccurrence[] {
  return meds
    .flatMap((m) => occurrencesBetween(m, zone, from, to))
    .sort(
      (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime() || a.medicationId.localeCompare(b.medicationId),
    );
}

/**
 * True when `instant` is a real scheduled dose of `med`. Used to reject forged dose
 * logs for times the medication was never scheduled.
 */
export function isScheduledInstant(med: MedicationSchedule, zone: string, instant: Date): boolean {
  const from = new Date(instant.getTime() - MINUTE_MS);
  const to = new Date(instant.getTime() + MINUTE_MS);
  return occurrencesBetween(med, zone, from, to).some((o) => o.scheduledFor.getTime() === instant.getTime());
}

/** A dose or routine can be recorded up to 3 hours early and up to 3 days late. */
export const LOG_EARLY_LIMIT_MS = 3 * HOUR_MS;
export const LOG_LATE_LIMIT_MS = 3 * DAY_MS;

export type LogWindowError = "too-early" | "too-old";

/** Whether an item scheduled for `scheduledFor` can be recorded at `now`. */
export function logWindowError(scheduledFor: Date, now: Date): LogWindowError | null {
  const delta = scheduledFor.getTime() - now.getTime();
  if (delta > LOG_EARLY_LIMIT_MS) return "too-early";
  if (-delta > LOG_LATE_LIMIT_MS) return "too-old";
  return null;
}

export interface RefillForecast {
  dailyUse: number;
  daysLeft: number | null;
  runsOutOn: string | null;
  needsRefill: boolean;
}

/** Estimates when a medication runs out from its stock, dose and schedule. */
export function forecastRefill(
  med: MedicationSchedule & { stockCount: number | null; doseQuantity: number; refillAt: number },
  zone: string,
  now: Date = new Date(),
): RefillForecast {
  const perDay = parseTimes(med.times).length * med.doseQuantity * (parseDays(med.daysOfWeek).length / 7);
  const dailyUse = Math.round(perDay * 100) / 100;
  if (med.stockCount === null || dailyUse <= 0) {
    return { dailyUse, daysLeft: null, runsOutOn: null, needsRefill: false };
  }
  const daysLeft = Math.max(0, Math.floor(med.stockCount / perDay));
  const runsOutOn = DateTime.fromJSDate(now, { zone }).plus({ days: daysLeft }).toISODate();
  // `refillAt` is measured in days of supply left, which is what a family actually plans around.
  return { dailyUse, daysLeft, runsOutOn, needsRefill: daysLeft <= med.refillAt };
}

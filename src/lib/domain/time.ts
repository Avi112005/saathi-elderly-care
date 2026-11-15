import { DateTime } from "luxon";

/** Matches a 24-hour "HH:MM" clock time. */
export const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(value: string): boolean {
  return CLOCK_TIME.test(value);
}

/** Minutes since local midnight for an "HH:MM" string. */
export function clockToMinutes(value: string): number {
  const match = CLOCK_TIME.exec(value);
  if (!match) throw new Error(`Invalid clock time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidTimeZone(zone: string): boolean {
  return DateTime.local().setZone(zone).isValid;
}

/**
 * True when `localTime` falls inside a quiet-hours window. Windows may wrap past
 * midnight (22:00 → 07:00). Equal start and end means "no quiet hours".
 */
export function isWithinQuietHours(localTime: string, start: string | null, end: string | null): boolean {
  if (!start || !end || start === end) return false;
  const t = clockToMinutes(localTime);
  const s = clockToMinutes(start);
  const e = clockToMinutes(end);
  return s < e ? t >= s && t < e : t >= s || t < e;
}

export type DayPart = "Early morning" | "Morning" | "Afternoon" | "Evening" | "Night";

/** Groups a local clock time into the part of day an elder would recognise. */
export function dayPartOf(localTime: string): DayPart {
  const m = clockToMinutes(localTime);
  if (m < 7 * 60) return "Early morning";
  if (m < 12 * 60) return "Morning";
  if (m < 17 * 60) return "Afternoon";
  if (m < 21 * 60) return "Evening";
  return "Night";
}

/** "08:00" → "8:00 AM" — elders read 12-hour times more easily. */
export function formatClock(localTime: string): string {
  const minutes = clockToMinutes(localTime);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function localClock(date: Date, zone: string): string {
  return DateTime.fromJSDate(date, { zone }).toFormat("HH:mm");
}

export function localDateKey(date: Date, zone: string): string {
  return DateTime.fromJSDate(date, { zone }).toISODate() ?? "";
}

/** Start (inclusive) and end (exclusive) of the local calendar day containing `date`. */
export function localDayBounds(date: Date, zone: string): { start: Date; end: Date } {
  const local = DateTime.fromJSDate(date, { zone }).startOf("day");
  return { start: local.toJSDate(), end: local.plus({ days: 1 }).toJSDate() };
}

export function ageFrom(dateOfBirth: Date | null | undefined, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const years = DateTime.fromJSDate(now).diff(DateTime.fromJSDate(dateOfBirth), "years").years;
  return Number.isFinite(years) ? Math.floor(years) : null;
}

export function greetingFor(date: Date, zone: string): string {
  const hour = DateTime.fromJSDate(date, { zone }).hour;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

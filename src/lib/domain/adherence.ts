import type { DoseOccurrence } from "./schedule";
import type { DoseStatus } from "./types";
import { dayPartOf, type DayPart } from "./time";

export interface LoggedDose {
  medicationId: string;
  scheduledFor: Date;
  status: DoseStatus;
}

export type DoseState = DoseStatus | "PENDING" | "OVERDUE";

export interface ResolvedDose extends DoseOccurrence {
  state: DoseState;
}

export const doseKey = (medicationId: string, scheduledFor: Date): string => `${medicationId}@${scheduledFor.toISOString()}`;

/**
 * Joins expected doses with what was logged. A dose with no log is OVERDUE once its
 * grace period has passed and PENDING before that.
 */
export function resolveDoses(
  expected: DoseOccurrence[],
  logs: LoggedDose[],
  now: Date,
  overdueAfterMin = 30,
): ResolvedDose[] {
  const byKey = new Map(logs.map((l) => [doseKey(l.medicationId, l.scheduledFor), l.status]));
  return expected.map((o) => {
    const logged = byKey.get(doseKey(o.medicationId, o.scheduledFor));
    if (logged) return { ...o, state: logged };
    const overdue = now.getTime() - o.scheduledFor.getTime() > overdueAfterMin * 60_000;
    return { ...o, state: overdue ? "OVERDUE" : "PENDING" };
  });
}

export interface AdherenceSummary {
  taken: number;
  skipped: number;
  missed: number;
  pending: number;
  /** Doses whose outcome is known or whose time has passed. */
  due: number;
  /** Taken ÷ due, 0–100, or null when nothing was due yet. */
  rate: number | null;
}

export function summarise(doses: ResolvedDose[]): AdherenceSummary {
  let taken = 0;
  let skipped = 0;
  let missed = 0;
  let pending = 0;
  for (const d of doses) {
    if (d.state === "TAKEN") taken++;
    else if (d.state === "SKIPPED") skipped++;
    else if (d.state === "MISSED" || d.state === "OVERDUE") missed++;
    else pending++;
  }
  const due = taken + skipped + missed;
  return { taken, skipped, missed, pending, due, rate: due === 0 ? null : Math.round((taken / due) * 100) };
}

export interface DayAdherence {
  date: string;
  summary: AdherenceSummary;
}

export function byDay(doses: ResolvedDose[]): DayAdherence[] {
  const groups = new Map<string, ResolvedDose[]>();
  for (const d of doses) {
    const list = groups.get(d.localDate) ?? [];
    list.push(d);
    groups.set(d.localDate, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, summary: summarise(list) }));
}

/**
 * Consecutive days on which every due dose was taken, counting back from the most
 * recent day. Days with nothing due yet (e.g. early this morning) are ignored rather
 * than breaking the streak.
 */
export function currentStreak(days: DayAdherence[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const { summary } = days[i]!;
    if (summary.due === 0) continue;
    if (summary.rate === 100) streak++;
    else break;
  }
  return streak;
}

export type InsightTone = "good" | "watch" | "act";

export interface Insight {
  tone: InsightTone;
  title: string;
  detail: string;
}

/**
 * Rule-based observations a caretaker would otherwise have to spot by hand.
 * Deterministic on purpose: every insight can be traced back to the dose history.
 */
export function deriveInsights(
  doses: ResolvedDose[],
  medNames: Map<string, string>,
  weekdayOf: (localDate: string) => number,
): Insight[] {
  const insights: Insight[] = [];
  const due = doses.filter((d) => d.state !== "PENDING");
  if (due.length < 5) {
    return [{ tone: "good", title: "Building a picture", detail: "Insights appear after a few days of logged doses." }];
  }

  const overall = summarise(due);
  if (overall.rate !== null && overall.rate >= 90) {
    insights.push({
      tone: "good",
      title: `${overall.rate}% of doses taken`,
      detail: "That is excellent adherence — well above the roughly 50% typical for long-term treatment.",
    });
  } else if (overall.rate !== null && overall.rate < 75) {
    insights.push({
      tone: "act",
      title: `Only ${overall.rate}% of doses taken`,
      detail: "Consider a pill organiser, moving doses next to meals, or asking the doctor whether the schedule can be simplified.",
    });
  }

  // Worst part of the day.
  const parts = new Map<DayPart, ResolvedDose[]>();
  for (const d of due) {
    const part = dayPartOf(d.localTime);
    parts.set(part, [...(parts.get(part) ?? []), d]);
  }
  let worstPart: { part: DayPart; rate: number; missed: number; total: number } | null = null;
  for (const [part, list] of parts) {
    const s = summarise(list);
    if (list.length >= 3 && s.rate !== null && s.rate < 85 && (!worstPart || s.rate < worstPart.rate)) {
      worstPart = { part, rate: s.rate, missed: s.missed + s.skipped, total: s.due };
    }
  }
  if (worstPart) {
    insights.push({
      tone: "watch",
      title: `${worstPart.part} doses are the hardest`,
      detail: `${worstPart.missed} of ${worstPart.total} ${worstPart.part.toLowerCase()} doses were not taken. Linking them to a fixed routine (a meal, a TV show, prayer time) often helps.`,
    });
  }

  // Least-adhered medication.
  const perMed = new Map<string, ResolvedDose[]>();
  for (const d of due) perMed.set(d.medicationId, [...(perMed.get(d.medicationId) ?? []), d]);
  let worstMed: { id: string; rate: number } | null = null;
  for (const [id, list] of perMed) {
    const s = summarise(list);
    if (list.length >= 3 && s.rate !== null && s.rate < 80 && (!worstMed || s.rate < worstMed.rate)) {
      worstMed = { id, rate: s.rate };
    }
  }
  if (worstMed) {
    insights.push({
      tone: "watch",
      title: `${medNames.get(worstMed.id) ?? "One medicine"} is often missed`,
      detail: `Taken ${worstMed.rate}% of the time. Ask whether side effects, taste or pill size are getting in the way.`,
    });
  }

  // Weekend dip.
  const weekend = due.filter((d) => weekdayOf(d.localDate) >= 6);
  const weekday = due.filter((d) => weekdayOf(d.localDate) <= 5);
  const we = summarise(weekend).rate;
  const wd = summarise(weekday).rate;
  if (weekend.length >= 4 && we !== null && wd !== null && wd - we >= 15) {
    insights.push({
      tone: "watch",
      title: "Weekends slip",
      detail: `${we}% on weekends vs ${wd}% on weekdays. Routines change on weekends — a family check-in call can help.`,
    });
  }

  return insights;
}

/**
 * Builds the list of doses to show/count for a period by combining the *current*
 * schedule (only from when it took effect) with what was actually logged. Logged doses
 * from an older schedule are kept, and the new schedule never back-fills phantom
 * "missed" doses before it existed.
 */
export function reconcileWithLogs(
  expected: DoseOccurrence[],
  logs: { medicationId: string; scheduledFor: Date }[],
  effectiveFrom: Map<string, Date>,
  toLocal: (d: Date) => { localTime: string; localDate: string },
): DoseOccurrence[] {
  const kept = expected.filter((o) => o.scheduledFor >= (effectiveFrom.get(o.medicationId) ?? new Date(0)));
  const keys = new Set(kept.map((o) => doseKey(o.medicationId, o.scheduledFor)));
  for (const l of logs) {
    if (keys.has(doseKey(l.medicationId, l.scheduledFor))) continue;
    keys.add(doseKey(l.medicationId, l.scheduledFor));
    kept.push({ medicationId: l.medicationId, scheduledFor: l.scheduledFor, ...toLocal(l.scheduledFor) });
  }
  return kept.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime() || a.medicationId.localeCompare(b.medicationId));
}

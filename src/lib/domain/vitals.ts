/**
 * Healthcare routines and the readings they produce. Thresholds follow widely published
 * adult guidance (e.g. ACC/AHA blood-pressure categories, ADA hypoglycaemia levels).
 * They flag a reading for attention — they are not a diagnosis, and a doctor's own
 * targets for the person always take priority.
 */

import { oneOf } from "./types";

export const ROUTINE_KINDS = ["ACTIVITY", "BLOOD_PRESSURE", "BLOOD_SUGAR", "PULSE", "WEIGHT"] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];
export const toRoutineKind = (value: string): RoutineKind => oneOf(ROUTINE_KINDS, value, "ACTIVITY");

export const ROUTINE_KIND_LABEL: Record<RoutineKind, string> = {
  ACTIVITY: "Activity or habit",
  BLOOD_PRESSURE: "Blood pressure check",
  BLOOD_SUGAR: "Blood sugar check",
  PULSE: "Pulse check",
  WEIGHT: "Weight check",
};

export const READING_UNIT: Record<RoutineKind, string> = {
  ACTIVITY: "",
  BLOOD_PRESSURE: "mmHg",
  BLOOD_SUGAR: "mg/dL",
  PULSE: "bpm",
  WEIGHT: "kg",
};

/** Physiologically plausible input ranges — anything outside is almost certainly a typo. */
export const READING_RANGE = {
  systolic: [50, 260],
  diastolic: [30, 160],
  BLOOD_SUGAR: [20, 600],
  PULSE: [25, 220],
  WEIGHT: [20, 250],
} as const;

export const VITAL_FLAGS = ["NORMAL", "LOW", "HIGH", "URGENT"] as const;
export type VitalFlag = (typeof VITAL_FLAGS)[number];
export const toVitalFlag = (value: string | null | undefined): VitalFlag => oneOf(VITAL_FLAGS, value, "NORMAL");

export const ROUTINE_STATUSES = ["DONE", "SKIPPED"] as const;
export type RoutineStatus = (typeof ROUTINE_STATUSES)[number];

export interface Reading {
  systolic?: number | null;
  diastolic?: number | null;
  value?: number | null;
}

export interface Assessment {
  flag: VitalFlag;
  /** Plain-language explanation shown next to the reading and in alert emails. */
  message: string;
}

/** Measurement routines record a reading; activities are simply done or skipped. */
export function isMeasurement(kind: RoutineKind): boolean {
  return kind !== "ACTIVITY";
}

/** Classifies a reading. Activities and weight are never flagged (weight trends need a doctor's context). */
export function assessReading(kind: RoutineKind, r: Reading): Assessment {
  switch (kind) {
    case "BLOOD_PRESSURE": {
      const sys = r.systolic ?? 0;
      const dia = r.diastolic ?? 0;
      if (sys >= 180 || dia >= 120)
        return {
          flag: "URGENT",
          message:
            "Very high — in the hypertensive-crisis range. Re-check after 5 minutes of rest and contact a doctor now if it stays this high.",
        };
      if (sys >= 140 || dia >= 90)
        return {
          flag: "HIGH",
          message:
            "Higher than the usual target. Re-check after resting; mention it to the doctor if it keeps happening.",
        };
      if (sys < 90 || dia < 60)
        return {
          flag: "LOW",
          message: "Lower than usual. Sit or lie down, drink some water, and watch for dizziness.",
        };
      return { flag: "NORMAL", message: "In the usual range." };
    }
    case "BLOOD_SUGAR": {
      const v = r.value ?? 0;
      if (v < 54)
        return {
          flag: "URGENT",
          message: "Dangerously low. Take 15 g of fast sugar (juice, glucose tablets) now and re-check in 15 minutes.",
        };
      if (v < 70)
        return {
          flag: "LOW",
          message: "Low. Have something sweet, re-check in 15 minutes, and don't skip the next meal.",
        };
      if (v > 300) return { flag: "URGENT", message: "Very high. Drink water and contact the doctor today." };
      if (v > 180)
        return {
          flag: "HIGH",
          message: "Higher than the usual target. Note what was eaten and mention it at the next visit.",
        };
      return { flag: "NORMAL", message: "In the usual range." };
    }
    case "PULSE": {
      const v = r.value ?? 0;
      if (v < 40 || v > 130)
        return {
          flag: "URGENT",
          message:
            "Far outside the usual range. Rest, re-check, and contact a doctor now if it persists or there is chest pain or faintness.",
        };
      if (v < 50)
        return {
          flag: "LOW",
          message: "Slower than usual. Fine for some people — mention it if there is tiredness or dizziness.",
        };
      if (v > 100) return { flag: "HIGH", message: "Faster than usual. Rest for 5 minutes and re-check." };
      return { flag: "NORMAL", message: "In the usual range." };
    }
    default:
      return { flag: "NORMAL", message: "" };
  }
}

/** "142/91 mmHg", "110 mg/dL", "72 bpm", "61.5 kg" — or "" when there is no reading. */
export function formatReading(kind: RoutineKind, r: Reading): string {
  if (kind === "BLOOD_PRESSURE") return r.systolic && r.diastolic ? `${r.systolic}/${r.diastolic} mmHg` : "";
  if (kind === "ACTIVITY" || r.value === null || r.value === undefined) return "";
  return `${r.value} ${READING_UNIT[kind]}`;
}

/** Who hears about a reading: urgent → the whole circle; high/low → the elder and caretakers. */
export function alertAudience(flag: VitalFlag): "ALL" | "CARE_TEAM" | "NONE" {
  if (flag === "URGENT") return "ALL";
  if (flag === "HIGH" || flag === "LOW") return "CARE_TEAM";
  return "NONE";
}

export interface ReadingPoint extends Reading {
  at: Date;
  flag: VitalFlag;
}

export interface ReadingSummary {
  count: number;
  latest: ReadingPoint | null;
  /** Mean over the period, rounded (systolic/diastolic for blood pressure). */
  average: Reading | null;
  flagged: number;
}

export function summariseReadings(kind: RoutineKind, points: ReadingPoint[]): ReadingSummary {
  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
  let average: Reading | null = null;
  if (sorted.length) {
    average =
      kind === "BLOOD_PRESSURE"
        ? {
            systolic: Math.round(mean(sorted.map((p) => p.systolic ?? 0)) ?? 0),
            diastolic: Math.round(mean(sorted.map((p) => p.diastolic ?? 0)) ?? 0),
          }
        : { value: mean(sorted.map((p) => p.value ?? 0)) };
  }
  return {
    count: sorted.length,
    latest: sorted.at(-1) ?? null,
    average,
    flagged: sorted.filter((p) => p.flag !== "NORMAL").length,
  };
}

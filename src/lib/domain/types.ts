/**
 * Shared domain vocabulary. SQLite has no enums, so these tuples are the single
 * source of truth for every enumerated column and are validated at the edges.
 */

export const ROLES = ["ELDER", "CARETAKER", "FAMILY"] as const;
export type Role = (typeof ROLES)[number];

/** Display order: the elder first, then the people caring for them. */
export const ROLE_ORDER: Record<Role, number> = { ELDER: 0, CARETAKER: 1, FAMILY: 2 };

export const ROLE_LABEL: Record<Role, string> = {
  ELDER: "Elder",
  CARETAKER: "Caretaker",
  FAMILY: "Family",
};

export const DOSE_STATUSES = ["TAKEN", "SKIPPED", "MISSED"] as const;
export type DoseStatus = (typeof DOSE_STATUSES)[number];

export const MED_FORMS = ["TABLET", "CAPSULE", "LIQUID", "INJECTION", "INHALER", "DROPS", "PATCH", "OTHER"] as const;
export type MedForm = (typeof MED_FORMS)[number];

export const MED_FORM_LABEL: Record<MedForm, string> = {
  TABLET: "Tablet",
  CAPSULE: "Capsule",
  LIQUID: "Liquid",
  INJECTION: "Injection",
  INHALER: "Inhaler",
  DROPS: "Drops",
  PATCH: "Patch",
  OTHER: "Other",
};

export const FOOD_TIMINGS = ["ANY", "BEFORE_FOOD", "WITH_FOOD", "AFTER_FOOD", "EMPTY_STOMACH"] as const;
export type FoodTiming = (typeof FOOD_TIMINGS)[number];

export const FOOD_TIMING_LABEL: Record<FoodTiming, string> = {
  ANY: "Any time",
  BEFORE_FOOD: "Before food",
  WITH_FOOD: "With food",
  AFTER_FOOD: "After food",
  EMPTY_STOMACH: "On an empty stomach",
};

export const PILL_COLORS = ["white", "yellow", "orange", "pink", "red", "blue", "green", "brown", "purple"] as const;
export type PillColor = (typeof PILL_COLORS)[number];

export const APPOINTMENT_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const CHANGE_KINDS = ["CREATE", "UPDATE", "ARCHIVE"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export const CHANGE_STATUSES = ["PENDING", "APPROVED", "DECLINED"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const NOTIFICATION_KINDS = [
  "DOSE_UPCOMING",
  "DOSE_NUDGE",
  "DOSE_MISSED",
  "APPOINTMENT",
  "REFILL",
  "DAILY_DIGEST",
  "CHANGE_REQUEST",
  "VITAL_ALERT",
  "ROUTINE_UPCOMING",
  "TEST",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Narrows a stored string to a known value, falling back to a safe default. */
export function oneOf<T extends string>(allowed: readonly T[], value: string | null | undefined, fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

export const toFoodTiming = (value: string): FoodTiming => oneOf(FOOD_TIMINGS, value, "ANY");
export const toDoseStatus = (value: string): DoseStatus => oneOf(DOSE_STATUSES, value, "MISSED");

/** "With food", "Before food"… or "" when the timing doesn't matter. */
export function foodTimingLabel(value: string): string {
  const timing = toFoodTiming(value);
  return timing === "ANY" ? "" : FOOD_TIMING_LABEL[timing];
}

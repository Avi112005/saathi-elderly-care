import { z } from "zod";
import { DateTime } from "luxon";
import { APPOINTMENT_STATUSES, FOOD_TIMINGS, MED_FORMS, PILL_COLORS } from "@/lib/domain/types";
import { READING_RANGE, ROUTINE_KINDS } from "@/lib/domain/vitals";
import { isClockTime, isValidTimeZone } from "@/lib/domain/time";
import { isValidPolicy } from "@/lib/domain/escalation";

/* ----------------------------------------------------------------------------
 * Primitives
 * ------------------------------------------------------------------------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const textBase = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
/**
 * Optional free text. Defaults to "" so a field a form doesn't render (e.g. "your name"
 * when an elder sets up their own circle) is treated as empty rather than invalid.
 */
const text = (max: number) => textBase(max).default("");
const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `Keep this under ${max} characters`);

export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => v === "" || EMAIL.test(v), "Enter a valid email address")
  .transform((v) => (v === "" ? null : v));

const isoDate = z
  .string()
  .trim()
  .refine((v) => ISO_DATE.test(v) && DateTime.fromISO(v).isValid, "Enter a valid date");

const optionalIsoDate = z
  .string()
  .trim()
  .refine((v) => v === "" || (ISO_DATE.test(v) && DateTime.fromISO(v).isValid), "Enter a valid date")
  .transform((v) => (v === "" ? null : v));

const clock = z.string().trim().refine(isClockTime, "Use a time like 08:00");
const optionalClock = z
  .string()
  .trim()
  .refine((v) => v === "" || isClockTime(v), "Use a time like 22:00")
  .transform((v) => (v === "" ? null : v));

/**
 * HTML checkboxes submit "on" when ticked and are *absent* when not, so the key must
 * be optional (a union containing undefined is not enough for Zod 4 object keys).
 */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => v === "on" || v === "true");

const timezone = z.string().trim().refine(isValidTimeZone, "Choose a valid time zone");

/* ----------------------------------------------------------------------------
 * Passcodes
 * ------------------------------------------------------------------------- */

const COMMON_PINS = new Set([
  "123456",
  "654321",
  "000000",
  "111111",
  "121212",
  "112233",
  "123123",
  "123321",
  "696969",
  "159753",
  "147258",
  "102030",
  "999999",
  "555555",
  "777777",
  "888888",
  "222222",
  "666666",
  "444444",
  "333333",
  "131313",
  "202020",
  "246810",
  "101010",
  "212121",
  "010101",
]);

/** Explains why a PIN is too weak, or returns null when it is acceptable. */
export function pinWeakness(pin: string): string | null {
  if (!/^\d{6,8}$/.test(pin)) return "Use 6 to 8 digits";
  if (/^(\d)\1+$/.test(pin)) return "Avoid repeating one digit";
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]!);
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1)) return "Avoid straight sequences like 123456";
  if (COMMON_PINS.has(pin)) return "That PIN is too common — pick something less guessable";
  return null;
}

export const pinSchema = z
  .string()
  .trim()
  .superRefine((pin, ctx) => {
    const problem = pinWeakness(pin);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/** Login only checks shape — strength is enforced when a PIN is set. */
export const pinAttemptSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "Enter your PIN using digits");

function confirmPins<T extends { pin: string; confirmPin: string }>(value: T, ctx: z.RefinementCtx) {
  if (value.pin !== value.confirmPin) {
    ctx.addIssue({ code: "custom", path: ["confirmPin"], message: "PINs do not match" });
  }
}

/* ----------------------------------------------------------------------------
 * Access
 * ------------------------------------------------------------------------- */

export const careCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/[^A-Z0-9]/g, ""))
  .refine((v) => /^[A-HJ-KMNP-Z2-9]{8}$/.test(v), "Care codes look like K7QM-4XPA")
  .transform((v) => `${v.slice(0, 4)}-${v.slice(4)}`);

export const loginSchema = z.object({
  careCode: careCodeSchema,
  memberId: z.string().trim().min(1).max(40),
  pin: pinAttemptSchema,
});

export const createCircleSchema = z
  .object({
    setupFor: z.enum(["SELF", "LOVED_ONE"]),
    elderFullName: requiredText("Full name", 80),
    elderPreferredName: requiredText("What they like to be called", 40),
    dateOfBirth: optionalIsoDate,
    timezone,
    conditions: text(500),
    allergies: text(300),
    consentMode: checkbox,
    yourName: text(60),
    relationship: text(40),
    email: optionalEmailSchema,
    pin: pinSchema,
    confirmPin: z.string().trim(),
    elderPin: z.string().trim().optional(),
    elderEmail: optionalEmailSchema.optional(),
  })
  .superRefine((v, ctx) => {
    confirmPins(v, ctx);
    if (v.setupFor === "LOVED_ONE") {
      if (!v.yourName) ctx.addIssue({ code: "custom", path: ["yourName"], message: "Your name is required" });
      if (v.elderPin) {
        const problem = pinWeakness(v.elderPin);
        if (problem) ctx.addIssue({ code: "custom", path: ["elderPin"], message: problem });
        else if (v.elderPin === v.pin)
          ctx.addIssue({ code: "custom", path: ["elderPin"], message: "Give them a different PIN from yours" });
      }
    }
  });

export const joinSchema = z
  .object({
    inviteCode: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/[^A-Z0-9]/g, "").replace(/^JOIN/, ""))
      .refine((v) => /^[A-HJ-KMNP-Z2-9]{12}$/.test(v), "Invite codes look like JOIN-8KD2-QF7M-4XPA")
      .transform((v) => `JOIN-${v.slice(0, 4)}-${v.slice(4, 8)}-${v.slice(8)}`),
    name: requiredText("Your name", 60),
    relationship: text(40),
    email: optionalEmailSchema,
    pin: pinSchema,
    confirmPin: z.string().trim(),
  })
  .superRefine(confirmPins);

export const changePinSchema = z
  .object({
    currentPin: pinAttemptSchema,
    pin: pinSchema,
    confirmPin: z.string().trim(),
  })
  .superRefine(confirmPins);

/* ----------------------------------------------------------------------------
 * Medications
 * ------------------------------------------------------------------------- */

export const medicationSchema = z
  .object({
    name: requiredText("Medicine name", 80),
    strength: text(40),
    form: z.enum(MED_FORMS),
    doseQuantity: z.coerce.number().positive("Dose must be more than 0").max(50, "That dose looks too large"),
    doseUnit: requiredText("Dose unit", 20),
    times: z.array(clock).min(1, "Add at least one time").max(8, "At most 8 times a day"),
    daysOfWeek: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one day"),
    startDate: isoDate,
    endDate: optionalIsoDate,
    foodTiming: z.enum(FOOD_TIMINGS),
    instructions: text(300),
    purpose: text(120),
    prescriber: text(80),
    appearance: text(80),
    pillColor: z.enum(PILL_COLORS),
    stockCount: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10_000), "Enter a stock between 0 and 10,000"),
    refillAt: z.coerce.number().int().min(0).max(90),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date" });
    }
    if (new Set(v.times).size !== v.times.length) {
      ctx.addIssue({ code: "custom", path: ["times"], message: "Each time should appear once" });
    }
  });

export type MedicationInput = z.infer<typeof medicationSchema>;

export const doseLogSchema = z.object({
  medicationId: z.string().trim().min(1).max(40),
  scheduledFor: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid dose time")
    .transform((v) => new Date(v)),
  status: z.enum(["TAKEN", "SKIPPED"]),
  note: text(200).default(""),
});

/* ----------------------------------------------------------------------------
 * Healthcare routines
 * ------------------------------------------------------------------------- */

export const routineSchema = z
  .object({
    title: requiredText("What the routine is", 80),
    kind: z.enum(ROUTINE_KINDS),
    times: z.array(clock).min(1, "Add at least one time").max(6, "At most 6 times a day"),
    daysOfWeek: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one day"),
    startDate: isoDate,
    endDate: optionalIsoDate,
    notes: text(300),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate)
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date" });
    if (new Set(v.times).size !== v.times.length)
      ctx.addIssue({ code: "custom", path: ["times"], message: "Each time should appear once" });
  });

export type RoutineInput = z.infer<typeof routineSchema>;

const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "Enter a number");

const inRange = (v: number | null, [min, max]: readonly [number, number]) => v === null || (v >= min && v <= max);

/** A routine check-off. Readings are range-checked against the routine's kind in the service. */
export const routineLogSchema = z.object({
  routineId: z.string().trim().min(1).max(40),
  scheduledFor: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid time")
    .transform((v) => new Date(v)),
  status: z.enum(["DONE", "SKIPPED"]),
  systolic: optionalNumber.refine((v) => inRange(v, READING_RANGE.systolic), "Top number looks wrong (50–260)"),
  diastolic: optionalNumber.refine((v) => inRange(v, READING_RANGE.diastolic), "Bottom number looks wrong (30–160)"),
  value: optionalNumber,
  note: text(200).default(""),
});

export type RoutineLogInput = z.infer<typeof routineLogSchema>;

/** Checks that a reading is present and plausible for the routine's kind. */
export function readingProblem(
  kind: (typeof ROUTINE_KINDS)[number],
  r: Pick<RoutineLogInput, "systolic" | "diastolic" | "value" | "status">,
): string | null {
  if (r.status === "SKIPPED" || kind === "ACTIVITY") return null;
  if (kind === "BLOOD_PRESSURE") {
    if (r.systolic === null || r.diastolic === null) return "Enter both blood-pressure numbers";
    if (r.diastolic >= r.systolic) return "The top number should be bigger than the bottom number";
    return null;
  }
  if (r.value === null) return "Enter the reading";
  return inRange(r.value, READING_RANGE[kind])
    ? null
    : `That reading looks wrong (${READING_RANGE[kind][0]}–${READING_RANGE[kind][1]})`;
}

/* ----------------------------------------------------------------------------
 * Appointments
 * ------------------------------------------------------------------------- */

export const appointmentSchema = z.object({
  title: requiredText("What the visit is for", 100),
  doctorName: text(80),
  specialty: text(60),
  location: text(160),
  date: isoDate,
  time: clock,
  durationMin: z.coerce.number().int().min(5).max(480),
  notes: text(1000),
  questions: text(1500),
  transport: text(160),
});

export const appointmentOutcomeSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  outcome: text(2000),
});

/* ----------------------------------------------------------------------------
 * Circle & settings
 * ------------------------------------------------------------------------- */

export const inviteSchema = z.object({
  role: z.enum(["CARETAKER", "FAMILY"]),
  label: text(60),
});

export const memberSettingsSchema = z
  .object({
    name: requiredText("Name", 60),
    relationship: text(40),
    email: optionalEmailSchema,
    emailDoseReminders: checkbox,
    emailMissedDoses: checkbox,
    emailAppointments: checkbox,
    emailRefills: checkbox,
    emailDailyDigest: checkbox,
    emailVitalAlerts: checkbox,
    quietStart: optionalClock,
    quietEnd: optionalClock,
  })
  .superRefine((v, ctx) => {
    if ((v.quietStart === null) !== (v.quietEnd === null)) {
      ctx.addIssue({ code: "custom", path: ["quietEnd"], message: "Set both a start and an end, or neither" });
    }
  });

export const profileSchema = z
  .object({
    fullName: requiredText("Full name", 80),
    preferredName: requiredText("Preferred name", 40),
    dateOfBirth: optionalIsoDate,
    timezone,
    conditions: text(500),
    allergies: text(300),
    bloodGroup: z
      .string()
      .trim()
      .refine((v) => v === "" || /^(A|B|AB|O)[+-]$/.test(v), "Use a blood group like O+ or AB-")
      .transform((v) => (v === "" ? null : v)),
    emergencyContact: text(160).transform((v) => (v === "" ? null : v)),
    primaryDoctor: text(160).transform((v) => (v === "" ? null : v)),
    notes: text(1000),
    reminderLeadMin: z.coerce.number().int(),
    nudgeAfterMin: z.coerce.number().int(),
    escalateAfterMin: z.coerce.number().int(),
  })
  .superRefine((v, ctx) => {
    if (
      !isValidPolicy({
        leadMin: v.reminderLeadMin,
        nudgeAfterMin: v.nudgeAfterMin,
        escalateAfterMin: v.escalateAfterMin,
      })
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["escalateAfterMin"],
        message:
          "The ladder must climb: reminder 0–120 min before, nudge at least 5 min after, escalation later than the nudge (max 12 h).",
      });
    }
  });

/* ----------------------------------------------------------------------------
 * FormData helpers
 * ------------------------------------------------------------------------- */

/**
 * Converts FormData to a plain object. Keys listed in `arrays` are collected with
 * getAll(); everything else takes the last string value. Files are ignored.
 */
export function formToObject(form: FormData, arrays: readonly string[] = []): Record<string, unknown> {
  // Null prototype + key filter: a field named "__proto__" can never reach Object.prototype.
  const out: Record<string, unknown> = Object.create(null);
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION") || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const values = form.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrays.includes(key) ? values.filter((v) => v !== "") : values.at(-1);
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}

export type FieldErrors = Record<string, string[]>;

/** Flattens a Zod error into `{ field: [messages] }` for form display. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

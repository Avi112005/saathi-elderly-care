/**
 * Seeds a realistic demo care circle (care code CARE-2468): Kamala Sharma (78), her
 * home caretaker Priya and her son Rahul, with six weeks of medicine history,
 * appointments and a pending change request. Re-running replaces only the demo circle.
 *
 * No credentials live in source control. Each demo PIN comes from the environment
 * (DEMO_ELDER_PIN, DEMO_CARETAKER_PIN, DEMO_FAMILY_PIN) or, if unset, is generated at
 * random and printed once to this terminal. Like every PIN, it is stored only as a hash.
 */
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { hashPasscode } from "../src/lib/server/crypto";
import { scheduleFor } from "../src/lib/domain/schedule";
import { dayPartOf } from "../src/lib/domain/time";
import { pinWeakness } from "../src/lib/validation/schemas";
import { assessReading, type RoutineKind } from "../src/lib/domain/vitals";

const prisma = new PrismaClient();
const ZONE = "Asia/Kolkata";
export const DEMO_CODE = "CARE-2468";

/** Deterministic PRNG so the demo looks the same on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A demo PIN from the environment (validated like any PIN), or a fresh random one. */
function demoPin(envName: string): string {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) {
    const problem = pinWeakness(fromEnv);
    if (problem) throw new Error(`${envName} is not an acceptable PIN: ${problem}`);
    return fromEnv;
  }
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!pinWeakness(pin)) return pin;
  }
}

async function main() {
  const pins = {
    elder: demoPin("DEMO_ELDER_PIN"),
    caretaker: demoPin("DEMO_CARETAKER_PIN"),
    family: demoPin("DEMO_FAMILY_PIN"),
  };
  const now = new Date();
  const today = DateTime.fromJSDate(now, { zone: ZONE }).startOf("day");
  const startDate = today.minus({ days: 42 }).toISODate()!;

  await prisma.careProfile.deleteMany({ where: { OR: [{ isDemo: true }, { careCode: DEMO_CODE }] } });

  const profile = await prisma.careProfile.create({
    data: {
      careCode: DEMO_CODE,
      fullName: "Kamala Devi Sharma",
      preferredName: "Kamala",
      dateOfBirth: new Date("1948-03-12T00:00:00Z"),
      timezone: ZONE,
      conditions: "Type 2 diabetes, Hypertension, Hypothyroidism, High cholesterol, Mild osteoarthritis (knees)",
      allergies: "Penicillin",
      bloodGroup: "B+",
      emergencyContact: "Rahul Sharma (son) · +91 98xxxxxx21",
      primaryDoctor: "Dr. Anil Mehta, Cardiologist · Sunrise Heart Clinic",
      notes: "Uses a walking stick. Prefers Hindi for phone calls. Reading glasses in the blue case.",
      consentMode: true,
      isDemo: true,
    },
  });

  const [kamala, priya, rahul] = await Promise.all([
    prisma.member.create({
      data: {
        profileId: profile.id,
        name: "Kamala",
        email: "kamala@example.com",
        relationship: "Self",
        role: "ELDER",
        isAdmin: true,
        passcodeHash: await hashPasscode(pins.elder),
        avatarColor: "marigold",
        emailDailyDigest: false,
      },
    }),
    prisma.member.create({
      data: {
        profileId: profile.id,
        name: "Priya",
        email: "priya.caretaker@example.com",
        relationship: "Home caretaker",
        role: "CARETAKER",
        passcodeHash: await hashPasscode(pins.caretaker),
        avatarColor: "sage",
        quietStart: "22:30",
        quietEnd: "06:30",
      },
    }),
    prisma.member.create({
      data: {
        profileId: profile.id,
        name: "Rahul",
        email: "rahul.sharma@example.com",
        relationship: "Son",
        role: "FAMILY",
        isAdmin: true,
        passcodeHash: await hashPasscode(pins.family),
        avatarColor: "sky",
        emailDoseReminders: false,
        emailDailyDigest: true,
      },
    }),
  ]);

  const created = today.minus({ days: 42 }).toJSDate();
  const meds = await Promise.all(
    [
      {
        name: "Levothyroxine",
        strength: "50 mcg",
        times: "06:30",
        foodTiming: "EMPTY_STOMACH",
        purpose: "Thyroid",
        appearance: "Small round white tablet, scored",
        pillColor: "white",
        stockCount: 38,
        instructions: "With water, 30 minutes before tea",
      },
      {
        name: "Metformin",
        strength: "500 mg",
        times: "08:00,20:00",
        foodTiming: "WITH_FOOD",
        purpose: "Diabetes (blood sugar)",
        appearance: "White oblong tablet",
        pillColor: "white",
        stockCount: 62,
      },
      {
        name: "Shelcal (Calcium + Vitamin D3)",
        strength: "500 mg",
        times: "08:30",
        foodTiming: "AFTER_FOOD",
        purpose: "Bones",
        appearance: "Large white oval tablet",
        pillColor: "white",
        stockCount: 21,
      },
      {
        name: "Amlodipine",
        strength: "5 mg",
        times: "09:00",
        foodTiming: "ANY",
        purpose: "Blood pressure",
        appearance: "White round tablet",
        pillColor: "white",
        stockCount: 24,
      },
      {
        name: "Ecosprin (Aspirin)",
        strength: "75 mg",
        times: "13:30",
        foodTiming: "AFTER_FOOD",
        purpose: "Heart protection",
        appearance: "Small orange coated tablet",
        pillColor: "orange",
        stockCount: 29,
      },
      {
        name: "Atorvastatin",
        strength: "10 mg",
        times: "21:00",
        foodTiming: "ANY",
        purpose: "Cholesterol",
        appearance: "White oval film-coated tablet",
        pillColor: "white",
        stockCount: 5,
        prescriber: "Dr. Anil Mehta",
      },
      {
        name: "Alprazolam",
        strength: "0.25 mg",
        times: "22:00",
        foodTiming: "ANY",
        purpose: "Sleep",
        appearance: "Tiny pink tablet",
        pillColor: "pink",
        stockCount: 14,
        prescriber: "Dr. S. Rao",
        instructions: "Only as prescribed — do not stop suddenly",
      },
    ].map((m) =>
      prisma.medication.create({
        data: {
          profileId: profile.id,
          form: "TABLET",
          doseQuantity: 1,
          doseUnit: "tablet",
          daysOfWeek: "1,2,3,4,5,6,7",
          startDate,
          refillAt: 7,
          prescriber: "Dr. Anil Mehta",
          instructions: "",
          createdAt: created,
          scheduleChangedAt: created,
          ...m,
        },
      }),
    ),
  );

  // ---- Dose history ------------------------------------------------------
  const rand = mulberry32(20261115);
  const history = scheduleFor(meds, ZONE, today.minus({ days: 30 }).toJSDate(), now);
  const logs = [];
  const recentCutoff = now.getTime() - 50 * 60_000; // leave the last ~hour unlogged so "Today" has live work
  for (const o of history) {
    if (o.scheduledFor.getTime() > recentCutoff) continue;
    const local = DateTime.fromJSDate(o.scheduledFor, { zone: ZONE });
    const part = dayPartOf(o.localTime);
    let p = part === "Night" ? 0.8 : part === "Evening" ? 0.88 : part === "Afternoon" ? 0.9 : 0.97;
    if (local.weekday >= 6) p -= 0.07;
    if (local.hasSame(DateTime.fromJSDate(now, { zone: ZONE }), "day")) p = 1;
    const r = rand();
    const status = r < p ? "TAKEN" : r < p + 0.03 ? "SKIPPED" : "MISSED";
    const loggers = [kamala.id, kamala.id, priya.id];
    logs.push({
      profileId: profile.id,
      medicationId: o.medicationId,
      scheduledFor: o.scheduledFor,
      status,
      actedAt:
        status === "TAKEN"
          ? new Date(o.scheduledFor.getTime() + Math.floor(rand() * 25) * 60_000)
          : new Date(o.scheduledFor.getTime() + 120 * 60_000),
      loggedById: status === "MISSED" ? null : loggers[Math.floor(rand() * loggers.length)]!,
      note:
        status === "SKIPPED"
          ? part === "Night"
            ? "Felt drowsy, slept early"
            : "Stomach upset"
          : status === "MISSED"
            ? "Marked missed automatically"
            : "",
    });
  }
  await prisma.doseLog.createMany({ data: logs });

  // ---- Healthcare routines with home readings ---------------------------
  const routines = await Promise.all(
    [
      {
        title: "Check blood pressure",
        kind: "BLOOD_PRESSURE",
        times: "08:30",
        daysOfWeek: "1,2,3,4,5,6,7",
        notes: "Sit quietly for 5 minutes first. Left arm.",
      },
      {
        title: "Fasting blood sugar",
        kind: "BLOOD_SUGAR",
        times: "07:00",
        daysOfWeek: "1,4",
        notes: "Before breakfast and before Levothyroxine tea.",
      },
      {
        title: "Evening walk",
        kind: "ACTIVITY",
        times: "18:00",
        daysOfWeek: "1,2,3,4,5,6,7",
        notes: "15 minutes around the colony with Priya.",
      },
    ].map((r) =>
      prisma.routine.create({
        data: { profileId: profile.id, startDate, createdAt: created, scheduleChangedAt: created, ...r },
      }),
    ),
  );
  const routineLogs = [];
  for (const o of scheduleFor(routines, ZONE, today.minus({ days: 30 }).toJSDate(), now)) {
    if (o.scheduledFor.getTime() > recentCutoff) continue;
    const routine = routines.find((r) => r.id === o.medicationId)!;
    const kind = routine.kind as RoutineKind;
    const weekend = DateTime.fromJSDate(o.scheduledFor, { zone: ZONE }).weekday >= 6;
    const doneChance = kind === "ACTIVITY" ? (weekend ? 0.55 : 0.75) : 0.88;
    if (rand() > doneChance) {
      routineLogs.push({
        profileId: profile.id,
        routineId: routine.id,
        scheduledFor: o.scheduledFor,
        status: "SKIPPED",
        note: kind === "ACTIVITY" ? "Knee pain" : "Forgot",
        loggedById: priya.id,
      });
      continue;
    }
    const reading =
      kind === "BLOOD_PRESSURE"
        ? {
            systolic: 124 + Math.round(rand() * 22) + (rand() < 0.08 ? 14 : 0),
            diastolic: 78 + Math.round(rand() * 10),
            value: null,
          }
        : kind === "BLOOD_SUGAR"
          ? { systolic: null, diastolic: null, value: 104 + Math.round(rand() * 60) + (rand() < 0.1 ? 40 : 0) }
          : { systolic: null, diastolic: null, value: null };
    routineLogs.push({
      profileId: profile.id,
      routineId: routine.id,
      scheduledFor: o.scheduledFor,
      status: "DONE",
      ...reading,
      flag: assessReading(kind, reading).flag,
      note: "",
      loggedById: rand() < 0.6 ? kamala.id : priya.id,
      actedAt: new Date(o.scheduledFor.getTime() + Math.floor(rand() * 20) * 60_000),
    });
  }
  await prisma.routineLog.createMany({ data: routineLogs });

  // ---- Appointments ------------------------------------------------------
  const at = (days: number, hour: number, minute = 0) => today.plus({ days }).set({ hour, minute }).toJSDate();
  await prisma.appointment.createMany({
    data: [
      {
        profileId: profile.id,
        title: "Cardiology follow-up",
        doctorName: "Dr. Anil Mehta",
        specialty: "Cardiology",
        location: "Sunrise Heart Clinic, 2nd floor, MG Road",
        startsAt: at(2, 11, 0),
        durationMin: 30,
        questions:
          "Is my blood pressure okay with the new routine?\nCan the sleeping tablet be reduced?\nShould Ecosprin continue?",
        transport: "Rahul will drive — leave home by 10:15",
        notes: "Carry last ECG and the Saathi health card.",
        createdById: rahul.id,
      },
      {
        profileId: profile.id,
        title: "Diabetes review + HbA1c",
        doctorName: "Dr. Meera Iyer",
        specialty: "Endocrinology",
        location: "City Diabetes Centre",
        startsAt: at(12, 9, 30),
        durationMin: 45,
        questions: "Fasting blood test — can I take Levothyroxine before?",
        notes: "Fasting from 10 PM the night before.",
        createdById: priya.id,
      },
      {
        profileId: profile.id,
        title: "Eye check-up",
        doctorName: "Dr. K. Nair",
        specialty: "Ophthalmology",
        location: "Vision Care Hospital",
        startsAt: at(-20, 16, 0),
        durationMin: 30,
        status: "COMPLETED",
        outcome: "Early cataract in the left eye — no surgery yet. New reading glasses (+2.5). Review in 6 months.",
        createdById: rahul.id,
      },
      {
        profileId: profile.id,
        title: "Dental cleaning",
        doctorName: "Dr. P. Shah",
        specialty: "Dentistry",
        location: "Smile Dental",
        startsAt: at(-6, 12, 0),
        durationMin: 30,
        status: "CANCELLED",
        outcome: "Rescheduled — knee pain that day.",
        createdById: priya.id,
      },
    ],
  });

  // ---- A pending change, waiting for Kamala's OK -------------------------
  const atorva = meds.find((m) => m.name === "Atorvastatin")!;
  await prisma.changeRequest.create({
    data: {
      profileId: profile.id,
      kind: "UPDATE",
      medicationId: atorva.id,
      requestedById: priya.id,
      summary: "update Atorvastatin (times → 8:00 PM)",
      payload: JSON.stringify({
        name: atorva.name,
        strength: atorva.strength,
        form: atorva.form,
        doseQuantity: 1,
        doseUnit: "tablet",
        times: ["20:00"],
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        startDate,
        endDate: null,
        foodTiming: "WITH_FOOD",
        instructions: "With dinner so it isn't forgotten",
        purpose: atorva.purpose,
        prescriber: atorva.prescriber,
        appearance: atorva.appearance,
        pillColor: atorva.pillColor,
        stockCount: atorva.stockCount,
        refillAt: 7,
      }),
    },
  });

  // ---- Activity ------------------------------------------------------------
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);
  await prisma.activityLog.createMany({
    data: [
      {
        profileId: profile.id,
        actorId: rahul.id,
        action: "circle.created",
        summary: "Rahul created the care circle for Kamala",
        createdAt: ago(24 * 42),
      },
      {
        profileId: profile.id,
        actorId: kamala.id,
        action: "member.joined",
        summary: "Kamala set her own PIN",
        createdAt: ago(24 * 42 - 1),
      },
      {
        profileId: profile.id,
        actorId: priya.id,
        action: "member.joined",
        summary: "Priya joined as caretaker",
        createdAt: ago(24 * 41),
      },
      {
        profileId: profile.id,
        actorId: rahul.id,
        action: "appointment.created",
        summary: 'Booked "Cardiology follow-up"',
        createdAt: ago(30),
      },
      {
        profileId: profile.id,
        actorId: priya.id,
        action: "request.created",
        summary: "Priya asked to update Atorvastatin (times → 8:00 PM)",
        createdAt: ago(5),
      },
      {
        profileId: profile.id,
        actorId: kamala.id,
        action: "appointment.question",
        summary: 'Kamala added a question for "Cardiology follow-up"',
        createdAt: ago(3),
      },
    ],
  });

  console.info(`Demo circle ready → care code ${DEMO_CODE}`);
  // Printed to the local terminal only so whoever ran the seed can sign in; never stored in plain text.
  console.info(
    `  Sign-in PINs — Kamala (elder): ${pins.elder} · Priya (caretaker): ${pins.caretaker} · Rahul (son): ${pins.family}`,
  );
  if (!process.env.DEMO_ELDER_PIN) console.info("  (Randomly generated. Set DEMO_*_PIN in .env to choose your own.)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import { DateTime } from "luxon";
import type { PrismaClient, Routine } from "@prisma/client";
import { logActivity } from "./audit";
import { isScheduledInstant, logWindowError } from "@/lib/domain/schedule";
import { formatClock, localClock } from "@/lib/domain/time";
import {
  alertAudience,
  assessReading,
  formatReading,
  isMeasurement,
  ROUTINE_KIND_LABEL,
  type VitalFlag,
  toRoutineKind,
} from "@/lib/domain/vitals";
import { readingProblem, type RoutineInput, type RoutineLogInput } from "@/lib/validation/schemas";
import { deliver, type Mailer } from "@/lib/email/mailer";
import { vitalAlertEmail } from "@/lib/email/templates";

export function toRoutineData(input: RoutineInput) {
  return {
    title: input.title,
    kind: input.kind,
    times: [...input.times].sort().join(","),
    daysOfWeek: [...new Set(input.daysOfWeek)].sort((a, b) => a - b).join(","),
    startDate: input.startDate,
    endDate: input.endDate,
    notes: input.notes,
  };
}

export async function saveRoutine(
  db: PrismaClient,
  args: { profileId: string; actorId: string; routineId: string | null; input: RoutineInput },
): Promise<Routine> {
  const data = toRoutineData(args.input);
  if (!args.routineId) {
    const created = await db.routine.create({ data: { ...data, profileId: args.profileId } });
    await logActivity(
      {
        profileId: args.profileId,
        actorId: args.actorId,
        action: "routine.created",
        summary: `Added routine "${created.title}"`,
      },
      db,
    );
    return created;
  }
  const existing = await db.routine.findFirst({ where: { id: args.routineId, profileId: args.profileId } });
  if (!existing) throw new Error("Routine not found");
  const scheduleChanged =
    data.times !== existing.times || data.daysOfWeek !== existing.daysOfWeek || data.startDate !== existing.startDate;
  const updated = await db.routine.update({
    where: { id: existing.id },
    data: { ...data, ...(scheduleChanged ? { scheduleChangedAt: new Date() } : {}) },
  });
  await logActivity(
    {
      profileId: args.profileId,
      actorId: args.actorId,
      action: "routine.updated",
      summary: `Updated routine "${updated.title}"`,
    },
    db,
  );
  return updated;
}

export async function stopRoutine(
  db: PrismaClient,
  args: { profileId: string; actorId: string; routineId: string },
): Promise<boolean> {
  const res = await db.routine.updateMany({
    where: { id: args.routineId, profileId: args.profileId, active: true },
    data: { active: false },
  });
  if (res.count === 0) return false;
  await logActivity(
    { profileId: args.profileId, actorId: args.actorId, action: "routine.stopped", summary: "Stopped a routine" },
    db,
  );
  return true;
}

export type RecordRoutineResult =
  { ok: true; flag: VitalFlag; message: string; alerted: number } | { ok: false; error: string };

/**
 * Records a routine as done (with its reading) or skipped. Out-of-range readings are
 * flagged and emailed straight away: urgent ones to the whole circle, high/low ones to
 * the elder and caretakers — each exactly once.
 */
export async function recordRoutine(
  db: PrismaClient,
  mailer: Mailer,
  args: {
    profileId: string;
    timezone: string;
    elderName: string;
    actorId: string;
    actorName: string;
    appUrl: string;
    input: RoutineLogInput;
  },
  now: Date = new Date(),
): Promise<RecordRoutineResult> {
  const { input } = args;
  const routine = await db.routine.findFirst({ where: { id: input.routineId, profileId: args.profileId } });
  if (!routine) return { ok: false, error: "That routine is no longer in the list." };
  if (!isScheduledInstant(routine, args.timezone, input.scheduledFor))
    return { ok: false, error: "That time isn't on the routine's schedule." };
  const windowError = logWindowError(input.scheduledFor, now);
  if (windowError === "too-early") return { ok: false, error: "That routine isn't due yet." };
  if (windowError === "too-old") return { ok: false, error: "That routine is too old to change." };

  const kind = toRoutineKind(routine.kind);
  const problem = readingProblem(kind, input);
  if (problem) return { ok: false, error: problem };

  const measured = input.status === "DONE" && isMeasurement(kind);
  const reading = measured
    ? kind === "BLOOD_PRESSURE"
      ? { systolic: input.systolic, diastolic: input.diastolic, value: null }
      : { systolic: null, diastolic: null, value: input.value }
    : { systolic: null, diastolic: null, value: null };
  const assessment = measured ? assessReading(kind, reading) : { flag: "NORMAL" as const, message: "" };

  const log = await db.routineLog.upsert({
    where: { routineId_scheduledFor: { routineId: routine.id, scheduledFor: input.scheduledFor } },
    create: {
      profileId: args.profileId,
      routineId: routine.id,
      scheduledFor: input.scheduledFor,
      status: input.status,
      ...reading,
      flag: assessment.flag,
      note: input.note,
      loggedById: args.actorId,
      actedAt: now,
    },
    update: {
      status: input.status,
      ...reading,
      flag: assessment.flag,
      note: input.note,
      loggedById: args.actorId,
      actedAt: now,
    },
  });

  const readingText = formatReading(kind, reading);
  await logActivity(
    {
      profileId: args.profileId,
      actorId: args.actorId,
      action: `routine.${input.status.toLowerCase()}`,
      summary: `${input.status === "DONE" ? "Did" : "Skipped"} "${routine.title}" (${formatClock(localClock(input.scheduledFor, args.timezone))})${readingText ? ` — ${readingText}${assessment.flag !== "NORMAL" ? ` (${assessment.flag.toLowerCase()})` : ""}` : ""}`,
    },
    db,
  );

  let alerted = 0;
  const audience = alertAudience(assessment.flag);
  if (audience !== "NONE") {
    const members = await db.member.findMany({
      where: { profileId: args.profileId, active: true, emailVitalAlerts: true, email: { not: null } },
    });
    const recipients = members.filter((m) => audience === "ALL" || m.role !== "FAMILY");
    const when = DateTime.fromJSDate(now, { zone: args.timezone }).toFormat("ccc d LLL, h:mm a");
    for (const m of recipients) {
      const outcome = await deliver(db, mailer, {
        profileId: args.profileId,
        memberId: m.id,
        to: m.email!,
        kind: "VITAL_ALERT",
        dedupeKey: `vital:${log.id}:${log.flag}:${readingText}:${m.id}`,
        email: vitalAlertEmail({
          recipientName: m.name,
          elderName: args.elderName,
          toElder: m.role === "ELDER",
          appUrl: args.appUrl,
          check: ROUTINE_KIND_LABEL[kind],
          reading: readingText,
          flag: assessment.flag as "LOW" | "HIGH" | "URGENT",
          advice: assessment.message,
          loggedBy: args.actorName,
          when,
        }),
      });
      if (outcome === "SENT" || outcome === "LOGGED") alerted++;
    }
  }
  return { ok: true, flag: assessment.flag, message: assessment.message, alerted };
}

export async function undoRoutine(
  db: PrismaClient,
  args: { profileId: string; actorId: string; routineId: string; scheduledFor: Date },
): Promise<boolean> {
  const res = await db.routineLog.deleteMany({
    where: { profileId: args.profileId, routineId: args.routineId, scheduledFor: args.scheduledFor },
  });
  if (res.count === 0) return false;
  await logActivity(
    {
      profileId: args.profileId,
      actorId: args.actorId,
      action: "routine.undone",
      summary: "Undid a routine check-off",
    },
    db,
  );
  return true;
}

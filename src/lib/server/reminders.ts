import { DateTime } from "luxon";
import { Prisma, type Medication, type Member, type PrismaClient } from "@prisma/client";
import { scheduleFor, forecastRefill, type DoseOccurrence } from "@/lib/domain/schedule";
import { doseKey } from "@/lib/domain/adherence";
import { appointmentStage, escalationStage, DEFAULT_POLICY, type EscalationPolicy } from "@/lib/domain/escalation";
import {
  DAY_MS,
  formatClock,
  HOUR_MS,
  isWithinQuietHours,
  localClock,
  localDayBounds,
  MINUTE_MS,
} from "@/lib/domain/time";
import { foodTimingLabel, type NotificationKind } from "@/lib/domain/types";
import { formatDose } from "@/lib/domain/format";
import { formatReading, ROUTINE_KIND_LABEL, toRoutineKind } from "@/lib/domain/vitals";
import { appUrl, deliver, type DeliveryResult, type Mailer } from "@/lib/email/mailer";
import {
  appointmentEmail,
  dailyDigestEmail,
  doseMissedEmail,
  doseNudgeEmail,
  doseUpcomingEmail,
  refillEmail,
  routineUpcomingEmail,
  type DoseLine,
  type RenderedEmail,
} from "@/lib/email/templates";

export interface SweepResult {
  profiles: number;
  markedMissed: number;
  emails: Record<DeliveryResult, number>;
}

/** Local hour at which the family's daily digest is sent. */
export const DIGEST_HOUR = 20;
/** SQLite caps bound parameters; dedupe keys are looked up in chunks of this size. */
const KEY_CHUNK = 500;

type Recipient = Pick<
  Member,
  | "id"
  | "name"
  | "email"
  | "role"
  | "emailDoseReminders"
  | "emailMissedDoses"
  | "emailAppointments"
  | "emailRefills"
  | "emailDailyDigest"
  | "quietStart"
  | "quietEnd"
>;

/** An email the sweep intends to send; rendered only if its key hasn't been used yet. */
interface Planned {
  profileId: string;
  recipient: Recipient;
  kind: NotificationKind;
  key: string;
  render: () => RenderedEmail;
}

export function doseLine(
  med: Pick<Medication, "name" | "strength" | "doseQuantity" | "doseUnit" | "foodTiming" | "instructions">,
): DoseLine {
  const food = foodTimingLabel(med.foodTiming);
  return {
    name: [med.name, med.strength].filter(Boolean).join(" "),
    dose: formatDose(med.doseQuantity, med.doseUnit),
    instructions: [food, med.instructions].filter(Boolean).join(". "),
  };
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * One pass of the reminder engine. Safe to run as often as you like (every minute is
 * typical): each email has a deterministic dedupe key, so repeated or overlapping runs
 * never send duplicates.
 *
 * Query cost is constant in the number of circles: one load of profiles (with members,
 * medicines and routines), one each for dose logs, routine logs and appointments, and
 * one (chunked) lookup of already-sent keys — then everything is planned in memory.
 */
export async function runReminderSweep(opts: {
  db: PrismaClient;
  mailer: Mailer;
  now?: Date;
  profileId?: string;
}): Promise<SweepResult> {
  const { db, mailer } = opts;
  const now = opts.now ?? new Date();
  const result: SweepResult = { profiles: 0, markedMissed: 0, emails: { SENT: 0, LOGGED: 0, FAILED: 0, DUPLICATE: 0 } };
  const base = appUrl();

  const profiles = await db.careProfile.findMany({
    where: opts.profileId ? { id: opts.profileId } : undefined,
    include: {
      members: { where: { active: true } },
      medications: { where: { active: true } },
      routines: { where: { active: true } },
    },
  });
  if (profiles.length === 0) return result;
  const ids = profiles.map((p) => p.id);

  // The widest window any rule needs: 24 h back (lookback, today's digest) to 48 h ahead
  // (tomorrow's appointments in the digest).
  const from = new Date(now.getTime() - DEFAULT_POLICY.lookbackMin * MINUTE_MS);
  const until = new Date(now.getTime() + (Math.max(...profiles.map((p) => p.reminderLeadMin)) + 1) * MINUTE_MS);
  const [doseLogs, routineLogs, appointments] = await Promise.all([
    db.doseLog.findMany({
      where: { profileId: { in: ids }, scheduledFor: { gte: from, lt: until } },
      select: { profileId: true, medicationId: true, scheduledFor: true, status: true },
    }),
    db.routineLog.findMany({
      where: { profileId: { in: ids }, scheduledFor: { gte: from, lt: until } },
      select: {
        profileId: true,
        routineId: true,
        scheduledFor: true,
        status: true,
        systolic: true,
        diastolic: true,
        value: true,
        flag: true,
      },
    }),
    db.appointment.findMany({
      where: {
        profileId: { in: ids },
        status: "SCHEDULED",
        startsAt: { gt: now, lte: new Date(now.getTime() + 48 * HOUR_MS) },
      },
    }),
  ]);
  const doseLogsBy = groupBy(doseLogs, (l) => l.profileId);
  const routineLogsBy = groupBy(routineLogs, (l) => l.profileId);
  const apptsBy = groupBy(appointments, (a) => a.profileId);

  const planned: Planned[] = [];

  for (const profile of profiles) {
    result.profiles++;
    const zone = profile.timezone;
    const policy: EscalationPolicy = {
      ...DEFAULT_POLICY,
      leadMin: profile.reminderLeadMin,
      nudgeAfterMin: profile.nudgeAfterMin,
      escalateAfterMin: profile.escalateAfterMin,
    };
    const recipients: Recipient[] = profile.members.filter((m) => m.email);
    const nowClock = localClock(now, zone);
    const quiet = (r: Recipient) => isWithinQuietHours(nowClock, r.quietStart, r.quietEnd);
    const who = (r: Recipient) => ({
      recipientName: r.name,
      elderName: profile.preferredName,
      toElder: r.role === "ELDER",
      appUrl: base,
    });
    const plan = (r: Recipient, kind: NotificationKind, key: string, render: () => RenderedEmail) =>
      planned.push({ profileId: profile.id, recipient: r, kind, key, render });

    /* ---- Doses ------------------------------------------------------- */
    const to = new Date(now.getTime() + (policy.leadMin + 1) * MINUTE_MS);
    const medById = new Map(profile.medications.map((m) => [m.id, m]));
    const doseLogsHere = doseLogsBy.get(profile.id) ?? [];
    const logged = new Set(doseLogsHere.map((l) => doseKey(l.medicationId, l.scheduledFor)));
    const open = scheduleFor(profile.medications, zone, from, to).filter(
      (o) =>
        !logged.has(doseKey(o.medicationId, o.scheduledFor)) &&
        o.scheduledFor >= medById.get(o.medicationId)!.scheduleChangedAt,
    );

    // Doses due at the same moment are grouped into one email per recipient.
    for (const [slotIso, doses] of groupBy<DoseOccurrence>(open, (o) => o.scheduledFor.toISOString())) {
      const at = new Date(slotIso);
      const stage = escalationStage(at, now, policy);
      if (stage === "NONE") continue;
      const time = formatClock(doses[0]!.localTime);
      const lines = doses.map((d) => doseLine(medById.get(d.medicationId)!));

      if (stage === "UPCOMING") {
        for (const r of recipients.filter((r) => r.emailDoseReminders && !quiet(r))) {
          plan(r, "DOSE_UPCOMING", `dose-upcoming:${profile.id}:${slotIso}:${r.id}`, () =>
            doseUpcomingEmail({ ...who(r), time, doses: lines }),
          );
        }
      } else if (stage === "NUDGE") {
        const minutesLate = Math.round((now.getTime() - at.getTime()) / MINUTE_MS);
        for (const r of recipients.filter((r) => r.emailMissedDoses && r.role !== "FAMILY")) {
          plan(r, "DOSE_NUDGE", `dose-nudge:${profile.id}:${slotIso}:${r.id}`, () =>
            doseNudgeEmail({ ...who(r), time, doses: lines, minutesLate }),
          );
        }
      } else {
        for (const d of doses) {
          try {
            await db.doseLog.create({
              data: {
                profileId: profile.id,
                medicationId: d.medicationId,
                scheduledFor: d.scheduledFor,
                status: "MISSED",
                loggedById: null,
                note: "Marked missed automatically",
              },
            });
            doseLogsHere.push({
              profileId: profile.id,
              medicationId: d.medicationId,
              scheduledFor: d.scheduledFor,
              status: "MISSED",
            });
            result.markedMissed++;
          } catch (err) {
            // Someone logged the dose between our read and this write — theirs wins.
            if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
          }
        }
        for (const r of recipients.filter((r) => r.emailMissedDoses)) {
          plan(r, "DOSE_MISSED", `dose-missed:${profile.id}:${slotIso}:${r.id}`, () =>
            doseMissedEmail({ ...who(r), time, doses: lines }),
          );
        }
      }
    }

    /* ---- Routines (a gentle reminder only — no escalation) ------------ */
    const routineById = new Map(profile.routines.map((r) => [r.id, r]));
    const routineDone = new Set((routineLogsBy.get(profile.id) ?? []).map((l) => doseKey(l.routineId, l.scheduledFor)));
    const upcomingRoutines = scheduleFor(profile.routines, zone, now, to).filter(
      (o) =>
        !routineDone.has(doseKey(o.medicationId, o.scheduledFor)) &&
        o.scheduledFor >= routineById.get(o.medicationId)!.scheduleChangedAt &&
        escalationStage(o.scheduledFor, now, policy) === "UPCOMING",
    );
    for (const [slotIso, items] of groupBy(upcomingRoutines, (o) => o.scheduledFor.toISOString())) {
      const time = formatClock(items[0]!.localTime);
      const titles = items.map((o) => routineById.get(o.medicationId)!.title);
      for (const r of recipients.filter((r) => r.emailDoseReminders && r.role !== "FAMILY" && !quiet(r))) {
        plan(r, "ROUTINE_UPCOMING", `routine-upcoming:${profile.id}:${slotIso}:${r.id}`, () =>
          routineUpcomingEmail({ ...who(r), time, routines: titles }),
        );
      }
    }

    /* ---- Appointments ------------------------------------------------ */
    for (const a of apptsBy.get(profile.id) ?? []) {
      const stage = appointmentStage(a.startsAt, now);
      if (stage === "NONE") continue;
      const when = DateTime.fromJSDate(a.startsAt, { zone }).toFormat("cccc d LLLL, h:mm a");
      const questions = a.questions
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean);
      for (const r of recipients.filter((r) => r.emailAppointments)) {
        plan(r, "APPOINTMENT", `appt:${a.id}:${stage}:${a.startsAt.toISOString()}:${r.id}`, () =>
          appointmentEmail({
            ...who(r),
            stage,
            title: a.title,
            when,
            doctor: a.doctorName,
            location: a.location,
            questions,
            transport: a.transport,
          }),
        );
      }
    }

    /* ---- Refills ----------------------------------------------------- */
    const week = DateTime.fromJSDate(now, { zone }).toFormat("kkkk-'W'WW");
    const lowStock: string[] = [];
    for (const med of profile.medications) {
      const forecast = forecastRefill(med, zone, now);
      if (!forecast.needsRefill || forecast.daysLeft === null || forecast.runsOutOn === null) continue;
      lowStock.push(doseLine(med).name);
      const runsOutOn = DateTime.fromISO(forecast.runsOutOn).toFormat("d LLL");
      const daysLeft = forecast.daysLeft;
      for (const r of recipients.filter((r) => r.emailRefills && !quiet(r))) {
        plan(r, "REFILL", `refill:${med.id}:${week}:${r.id}`, () =>
          refillEmail({ ...who(r), medicine: doseLine(med).name, daysLeft, runsOutOn }),
        );
      }
    }

    /* ---- Daily digest ------------------------------------------------ */
    const localNow = DateTime.fromJSDate(now, { zone });
    const digestTo = recipients.filter((r) => r.emailDailyDigest && !quiet(r));
    if (localNow.hour >= DIGEST_HOUR && digestTo.length > 0) {
      const day = localDayBounds(now, zone);
      const todays = scheduleFor(profile.medications, zone, day.start, now).filter(
        (o) => o.scheduledFor >= medById.get(o.medicationId)!.scheduleChangedAt,
      );
      const statusOf = new Map(doseLogsHere.map((l) => [doseKey(l.medicationId, l.scheduledFor), l.status]));
      const taken = todays.filter((o) => statusOf.get(doseKey(o.medicationId, o.scheduledFor)) === "TAKEN").length;
      const missed = todays
        .filter((o) => {
          const s = statusOf.get(doseKey(o.medicationId, o.scheduledFor));
          return (
            s === "MISSED" ||
            (s === undefined && now.getTime() - o.scheduledFor.getTime() > policy.nudgeAfterMin * MINUTE_MS)
          );
        })
        .map((o) => `${doseLine(medById.get(o.medicationId)!).name} at ${formatClock(o.localTime)}`);
      const upcoming = (apptsBy.get(profile.id) ?? [])
        .filter((a) => a.startsAt >= day.end && a.startsAt.getTime() < day.end.getTime() + DAY_MS)
        .map((a) => `${a.title}, ${DateTime.fromJSDate(a.startsAt, { zone }).toFormat("h:mm a")} tomorrow`);
      const readings = (routineLogsBy.get(profile.id) ?? [])
        .filter(
          (l) =>
            l.status === "DONE" &&
            l.scheduledFor >= day.start &&
            l.scheduledFor < day.end &&
            routineById.has(l.routineId),
        )
        .map((l) => {
          const kind = toRoutineKind(routineById.get(l.routineId)!.kind);
          const text = formatReading(kind, l);
          return text
            ? `${ROUTINE_KIND_LABEL[kind]} ${text}${l.flag !== "NORMAL" ? ` (${l.flag.toLowerCase()})` : ""}`
            : "";
        })
        .filter(Boolean);
      const dateLabel = localNow.toFormat("d LLLL");
      for (const r of digestTo) {
        plan(r, "DAILY_DIGEST", `digest:${profile.id}:${localNow.toISODate()}:${r.id}`, () =>
          dailyDigestEmail({
            ...who(r),
            date: dateLabel,
            taken,
            due: todays.length,
            missed,
            upcoming,
            lowStock,
            readings,
          }),
        );
      }
    }
  }

  /* ---- Deliver everything not already sent -------------------------- */
  const sent = new Set<string>();
  for (let i = 0; i < planned.length; i += KEY_CHUNK) {
    const keys = planned.slice(i, i + KEY_CHUNK).map((p) => p.key);
    const rows = await db.notification.findMany({ where: { dedupeKey: { in: keys } }, select: { dedupeKey: true } });
    for (const row of rows) sent.add(row.dedupeKey);
  }
  for (const p of planned) {
    if (sent.has(p.key)) {
      result.emails.DUPLICATE++;
      continue;
    }
    sent.add(p.key);
    const outcome = await deliver(db, mailer, {
      profileId: p.profileId,
      memberId: p.recipient.id,
      to: p.recipient.email!,
      kind: p.kind,
      dedupeKey: p.key,
      email: p.render(),
    });
    result.emails[outcome]++;
  }

  return result;
}

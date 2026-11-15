import "server-only";
import { DateTime } from "luxon";
import type { CareProfile, Medication } from "@prisma/client";
import { prisma } from "./db";
import { forecastRefill, scheduleFor } from "@/lib/domain/schedule";
import {
  byDay,
  currentStreak,
  deriveInsights,
  doseKey,
  reconcileWithLogs,
  resolveDoses,
  summarise,
  type ResolvedDose,
} from "@/lib/domain/adherence";
import { reviewMedications, type SafetyFinding } from "@/lib/domain/safety";
import {
  ageFrom,
  DAY_MS,
  type DayPart,
  dayPartOf,
  HOUR_MS,
  localClock,
  localDateKey,
  localDayBounds,
} from "@/lib/domain/time";
import {
  isMeasurement,
  summariseReadings,
  type ReadingSummary,
  type RoutineKind,
  type VitalFlag,
  toRoutineKind,
  toVitalFlag,
} from "@/lib/domain/vitals";
import { toDoseStatus } from "@/lib/domain/types";

const toLocal = (zone: string) => (d: Date) => ({ localTime: localClock(d, zone), localDate: localDateKey(d, zone) });

/** Safety review from data the caller has already loaded — no extra queries. */
export function safetyFindings(
  profile: Pick<CareProfile, "allergies" | "dateOfBirth">,
  activeMeds: Pick<Medication, "name" | "times">[],
): SafetyFinding[] {
  return reviewMedications(activeMeds, { allergies: profile.allergies, age: ageFrom(profile.dateOfBirth) });
}

export interface TodayDose extends ResolvedDose {
  med: Pick<
    Medication,
    | "id"
    | "name"
    | "strength"
    | "doseQuantity"
    | "doseUnit"
    | "foodTiming"
    | "instructions"
    | "appearance"
    | "pillColor"
    | "purpose"
  >;
  loggedBy: string | null;
  note: string;
  actedAt: Date | null;
}

export interface TodayRoutine {
  routineId: string;
  scheduledFor: Date;
  localTime: string;
  title: string;
  kind: RoutineKind;
  notes: string;
  status: "DONE" | "SKIPPED" | null;
  reading: { systolic: number | null; diastolic: number | null; value: number | null };
  flag: VitalFlag;
  loggedBy: string | null;
}

/** Everything the "Today" screen needs, in a single parallel round of queries. */
export async function getTodayView(profileId: string, now: Date = new Date()) {
  const profile = await prisma.careProfile.findUniqueOrThrow({ where: { id: profileId } });
  const zone = profile.timezone;
  const day = localDayBounds(now, zone);

  const [meds, logs, routines, routineLogs, appointments, requests] = await Promise.all([
    prisma.medication.findMany({ where: { profileId, active: true }, orderBy: { name: "asc" } }),
    prisma.doseLog.findMany({
      where: { profileId, scheduledFor: { gte: day.start, lt: day.end } },
      include: { loggedBy: { select: { name: true } } },
    }),
    prisma.routine.findMany({ where: { profileId, active: true } }),
    prisma.routineLog.findMany({
      where: { profileId, scheduledFor: { gte: day.start, lt: day.end } },
      include: { loggedBy: { select: { name: true } } },
    }),
    prisma.appointment.findMany({
      where: { profileId, status: "SCHEDULED", startsAt: { gte: new Date(now.getTime() - HOUR_MS) } },
      orderBy: { startsAt: "asc" },
      take: 3,
    }),
    prisma.changeRequest.findMany({
      where: { profileId, status: "PENDING" },
      include: { requestedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  /* Medicines */
  const medById = new Map(meds.map((m) => [m.id, m]));
  const activeLogs = logs.filter((l) => medById.has(l.medicationId));
  const logByKey = new Map(activeLogs.map((l) => [doseKey(l.medicationId, l.scheduledFor), l]));
  const expected = reconcileWithLogs(
    scheduleFor(meds, zone, day.start, day.end),
    activeLogs,
    new Map(meds.map((m) => [m.id, m.scheduleChangedAt])),
    toLocal(zone),
  );
  const resolved = resolveDoses(
    expected,
    activeLogs.map((l) => ({
      medicationId: l.medicationId,
      scheduledFor: l.scheduledFor,
      status: toDoseStatus(l.status),
    })),
    now,
    profile.nudgeAfterMin,
  );
  const doses: TodayDose[] = resolved.map((d) => {
    const med = medById.get(d.medicationId)!;
    const log = logByKey.get(doseKey(d.medicationId, d.scheduledFor));
    return {
      ...d,
      med,
      loggedBy: log ? (log.loggedBy?.name ?? "Saathi") : null,
      note: log?.note ?? "",
      actedAt: log?.actedAt ?? null,
    };
  });
  const groups = new Map<DayPart, TodayDose[]>();
  for (const d of doses) {
    const part = dayPartOf(d.localTime);
    const list = groups.get(part);
    if (list) list.push(d);
    else groups.set(part, [d]);
  }

  /* Routines */
  const routineById = new Map(routines.map((r) => [r.id, r]));
  const routineLogByKey = new Map(
    routineLogs.filter((l) => routineById.has(l.routineId)).map((l) => [doseKey(l.routineId, l.scheduledFor), l]),
  );
  const routineItems: TodayRoutine[] = reconcileWithLogs(
    scheduleFor(routines, zone, day.start, day.end),
    [...routineLogByKey.values()].map((l) => ({ medicationId: l.routineId, scheduledFor: l.scheduledFor })),
    new Map(routines.map((r) => [r.id, r.scheduleChangedAt])),
    toLocal(zone),
  ).map((o) => {
    const routine = routineById.get(o.medicationId)!;
    const log = routineLogByKey.get(doseKey(o.medicationId, o.scheduledFor));
    return {
      routineId: routine.id,
      scheduledFor: o.scheduledFor,
      localTime: o.localTime,
      title: routine.title,
      kind: toRoutineKind(routine.kind),
      notes: routine.notes,
      status: (log?.status as "DONE" | "SKIPPED" | undefined) ?? null,
      reading: { systolic: log?.systolic ?? null, diastolic: log?.diastolic ?? null, value: log?.value ?? null },
      flag: toVitalFlag(log?.flag),
      loggedBy: log?.loggedBy?.name ?? null,
    };
  });

  return {
    profile,
    doses,
    groups: [...groups.entries()],
    summary: summarise(resolved),
    next: doses.find((d) => d.state === "PENDING" || d.state === "OVERDUE") ?? null,
    routines: routineItems,
    appointments,
    requests,
    refills: meds
      .map((m) => ({ med: m, forecast: forecastRefill(m, zone, now) }))
      .filter((r) => r.forecast.needsRefill),
    findings: safetyFindings(profile, meds).filter((f) => f.severity !== "info"),
    medCount: meds.length,
  };
}

/** Adherence analytics over the last `days` days (today included up to `now`). */
export async function getAdherenceView(
  profileId: string,
  days = 30,
  now: Date = new Date(),
  loadedProfile?: CareProfile,
) {
  const profile = loadedProfile ?? (await prisma.careProfile.findUniqueOrThrow({ where: { id: profileId } }));
  const zone = profile.timezone;
  const start = DateTime.fromJSDate(now, { zone })
    .startOf("day")
    .minus({ days: days - 1 })
    .toJSDate();

  const [meds, logs] = await Promise.all([
    prisma.medication.findMany({ where: { profileId } }),
    prisma.doseLog.findMany({
      where: { profileId, scheduledFor: { gte: start, lt: now } },
      select: { medicationId: true, scheduledFor: true, status: true },
    }),
  ]);

  // Current schedules count from when they took effect; everything earlier (including
  // stopped medicines and old schedules) is counted from the dose log itself.
  const expected = reconcileWithLogs(
    scheduleFor(
      meds.filter((m) => m.active),
      zone,
      start,
      now,
    ),
    logs,
    new Map(meds.map((m) => [m.id, m.scheduleChangedAt])),
    toLocal(zone),
  );
  const resolved = resolveDoses(
    expected,
    logs.map((l) => ({ ...l, status: toDoseStatus(l.status) })),
    now,
    profile.nudgeAfterMin,
  );
  const due = resolved.filter((d) => d.state !== "PENDING");
  const daily = byDay(resolved);

  const dueByMed = new Map<string, ResolvedDose[]>();
  const dueByPart = new Map<DayPart, ResolvedDose[]>();
  for (const d of due) {
    dueByMed.set(d.medicationId, [...(dueByMed.get(d.medicationId) ?? []), d]);
    const part = dayPartOf(d.localTime);
    dueByPart.set(part, [...(dueByPart.get(part) ?? []), d]);
  }

  const perMed = meds
    .filter((m) => dueByMed.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      strength: m.strength,
      active: m.active,
      summary: summarise(dueByMed.get(m.id)!),
    }))
    .sort((a, b) => (a.summary.rate ?? 101) - (b.summary.rate ?? 101));

  const PARTS: DayPart[] = ["Early morning", "Morning", "Afternoon", "Evening", "Night"];
  const perPart = PARTS.filter((p) => dueByPart.has(p)).map((part) => ({
    part,
    summary: summarise(dueByPart.get(part)!),
  }));

  const weekdayOf = (iso: string) => DateTime.fromISO(iso, { zone }).weekday;
  return {
    profile,
    activeMeds: meds.filter((m) => m.active),
    summary: summarise(due),
    daily,
    perMed,
    perPart,
    streak: currentStreak(daily),
    insights: deriveInsights(resolved, new Map(meds.map((m) => [m.id, m.name])), weekdayOf),
    start,
  };
}

export interface VitalsRow {
  routineId: string;
  title: string;
  kind: RoutineKind;
  summary: ReadingSummary;
  recent: { at: Date; systolic: number | null; diastolic: number | null; value: number | null; flag: VitalFlag }[];
}

/** Readings from measurement routines (BP, sugar, pulse, weight) over the last `days` days. */
export async function getVitalsView(profileId: string, days = 30, now: Date = new Date()): Promise<VitalsRow[]> {
  const since = new Date(now.getTime() - days * DAY_MS);
  const routines = await prisma.routine.findMany({
    where: { profileId, kind: { not: "ACTIVITY" } },
    include: {
      logs: { where: { status: "DONE", scheduledFor: { gte: since, lt: now } }, orderBy: { scheduledFor: "desc" } },
    },
    orderBy: { title: "asc" },
  });
  return routines
    .filter((r) => isMeasurement(toRoutineKind(r.kind)) && (r.active || r.logs.length > 0))
    .map((r) => {
      const kind = toRoutineKind(r.kind);
      const points = r.logs.map((l) => ({
        at: l.scheduledFor,
        systolic: l.systolic,
        diastolic: l.diastolic,
        value: l.value,
        flag: toVitalFlag(l.flag),
      }));
      return {
        routineId: r.id,
        title: r.title,
        kind,
        summary: summariseReadings(kind, points),
        recent: points.slice(0, 7),
      };
    });
}

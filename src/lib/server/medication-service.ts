import type { Medication, PrismaClient } from "@prisma/client";
import { logActivity } from "./audit";
import { isScheduledInstant, logWindowError } from "@/lib/domain/schedule";
import { formatClock, localClock } from "@/lib/domain/time";
import { formatDose } from "@/lib/domain/format";
import type { MedicationInput } from "@/lib/validation/schemas";
import type { ChangeKind } from "@/lib/domain/types";

/** Maps validated form input to database columns. */
export function toMedicationData(input: MedicationInput) {
  return {
    name: input.name,
    strength: input.strength,
    form: input.form,
    doseQuantity: input.doseQuantity,
    doseUnit: input.doseUnit,
    times: [...input.times].sort().join(","),
    daysOfWeek: [...new Set(input.daysOfWeek)].sort((a, b) => a - b).join(","),
    startDate: input.startDate,
    endDate: input.endDate,
    foodTiming: input.foodTiming,
    instructions: input.instructions,
    purpose: input.purpose,
    prescriber: input.prescriber,
    appearance: input.appearance,
    pillColor: input.pillColor,
    stockCount: input.stockCount,
    refillAt: input.refillAt,
  };
}

/** A one-line, human description of a proposed change, shown to the elder for approval. */
export function describeChange(kind: ChangeKind, input: MedicationInput | null, existing: Medication | null): string {
  const name = input?.name ?? existing?.name ?? "a medicine";
  if (kind === "ARCHIVE") return `stop ${name}`;
  if (kind === "CREATE" && input) {
    return `add ${name}${input.strength ? ` ${input.strength}` : ""} — ${formatDose(input.doseQuantity, input.doseUnit)} at ${input.times.map(formatClock).join(", ")}`;
  }
  if (!input || !existing) return `update ${name}`;
  const changes: string[] = [];
  const next = toMedicationData(input);
  if (next.times !== existing.times) changes.push(`times → ${input.times.map(formatClock).join(", ")}`);
  if (next.doseQuantity !== existing.doseQuantity || next.doseUnit !== existing.doseUnit)
    changes.push(`dose → ${formatDose(input.doseQuantity, input.doseUnit)}`);
  if (next.strength !== existing.strength) changes.push(`strength → ${input.strength || "none"}`);
  if (next.daysOfWeek !== existing.daysOfWeek) changes.push("days changed");
  if (next.endDate !== existing.endDate) changes.push(next.endDate ? `ends ${next.endDate}` : "no end date");
  if (next.name !== existing.name) changes.push(`renamed from ${existing.name}`);
  return `update ${name}${changes.length ? ` (${changes.join("; ")})` : " (details)"}`;
}

/**
 * Applies a medication change immediately. Used directly by the elder (or anyone when
 * consent mode is off) and when the elder approves a change request.
 */
export async function applyMedicationChange(
  db: PrismaClient,
  change: {
    kind: ChangeKind;
    profileId: string;
    medicationId: string | null;
    input: MedicationInput | null;
    actorId: string;
    viaRequest?: string;
  },
): Promise<Medication> {
  const suffix = change.viaRequest ? " (approved request)" : "";
  if (change.kind === "CREATE") {
    if (!change.input) throw new Error("Missing medication input");
    const med = await db.medication.create({
      data: { profileId: change.profileId, ...toMedicationData(change.input) },
    });
    await logActivity(
      {
        profileId: change.profileId,
        actorId: change.actorId,
        action: "medication.created",
        summary: `Added ${med.name}${suffix}`,
      },
      db,
    );
    return med;
  }
  const existing = await db.medication.findFirst({
    where: { id: change.medicationId ?? "", profileId: change.profileId },
  });
  if (!existing) throw new Error("Medication not found");
  if (change.kind === "ARCHIVE") {
    const med = await db.medication.update({ where: { id: existing.id }, data: { active: false } });
    await logActivity(
      {
        profileId: change.profileId,
        actorId: change.actorId,
        action: "medication.stopped",
        summary: `Stopped ${med.name}${suffix}`,
      },
      db,
    );
    return med;
  }
  if (!change.input) throw new Error("Missing medication input");
  const summary = describeChange("UPDATE", change.input, existing);
  const data = toMedicationData(change.input);
  const scheduleChanged =
    data.times !== existing.times || data.daysOfWeek !== existing.daysOfWeek || data.startDate !== existing.startDate;
  const med = await db.medication.update({
    where: { id: existing.id },
    data: { ...data, ...(scheduleChanged ? { scheduleChangedAt: new Date() } : {}) },
  });
  await logActivity(
    {
      profileId: change.profileId,
      actorId: change.actorId,
      action: "medication.updated",
      summary: `${summary.charAt(0).toUpperCase()}${summary.slice(1)}${suffix}`,
    },
    db,
  );
  return med;
}

export type DoseLogError = "not-found" | "not-scheduled" | "too-early" | "too-old";

/**
 * Records a dose as taken or skipped. The instant must be a real scheduled dose of
 * that medicine, within a sensible window, so logs cannot be forged for arbitrary times.
 * Stock is decremented when a dose is taken and restored if that is undone.
 */
export async function recordDose(
  db: PrismaClient,
  input: {
    profileId: string;
    timezone: string;
    medicationId: string;
    scheduledFor: Date;
    status: "TAKEN" | "SKIPPED";
    note: string;
    actorId: string;
  },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: DoseLogError }> {
  const med = await db.medication.findFirst({ where: { id: input.medicationId, profileId: input.profileId } });
  if (!med) return { ok: false, error: "not-found" };
  if (!isScheduledInstant(med, input.timezone, input.scheduledFor)) return { ok: false, error: "not-scheduled" };
  const windowError = logWindowError(input.scheduledFor, now);
  if (windowError) return { ok: false, error: windowError };

  await db.$transaction(async (tx) => {
    const previous = await tx.doseLog.findUnique({
      where: { medicationId_scheduledFor: { medicationId: med.id, scheduledFor: input.scheduledFor } },
    });
    await tx.doseLog.upsert({
      where: { medicationId_scheduledFor: { medicationId: med.id, scheduledFor: input.scheduledFor } },
      create: {
        profileId: input.profileId,
        medicationId: med.id,
        scheduledFor: input.scheduledFor,
        status: input.status,
        loggedById: input.actorId,
        note: input.note,
        actedAt: now,
      },
      update: { status: input.status, loggedById: input.actorId, note: input.note, actedAt: now },
    });
    const wasTaken = previous?.status === "TAKEN";
    const isTaken = input.status === "TAKEN";
    if (med.stockCount !== null && wasTaken !== isTaken) {
      const change = isTaken ? -med.doseQuantity : med.doseQuantity;
      await tx.medication.update({ where: { id: med.id }, data: { stockCount: Math.max(0, med.stockCount + change) } });
    }
    const late = previous?.status === "MISSED" ? " (late)" : "";
    await logActivity(
      {
        profileId: input.profileId,
        actorId: input.actorId,
        action: `dose.${input.status.toLowerCase()}`,
        summary: `${input.status === "TAKEN" ? "Took" : "Skipped"} ${med.name} (${formatClock(localClock(input.scheduledFor, input.timezone))} dose)${late}${input.note ? ` — ${input.note}` : ""}`,
      },
      tx,
    );
  });
  return { ok: true };
}

/** Clears a dose log (undo). Restores stock if the dose had been marked taken. */
export async function undoDose(
  db: PrismaClient,
  input: { profileId: string; timezone: string; medicationId: string; scheduledFor: Date; actorId: string },
): Promise<boolean> {
  const log = await db.doseLog.findFirst({
    where: { profileId: input.profileId, medicationId: input.medicationId, scheduledFor: input.scheduledFor },
    include: { medication: true },
  });
  if (!log) return false;
  await db.$transaction(async (tx) => {
    await tx.doseLog.delete({ where: { id: log.id } });
    if (log.status === "TAKEN" && log.medication.stockCount !== null) {
      await tx.medication.update({
        where: { id: log.medicationId },
        data: { stockCount: log.medication.stockCount + log.medication.doseQuantity },
      });
    }
    await logActivity(
      {
        profileId: input.profileId,
        actorId: input.actorId,
        action: "dose.undone",
        summary: `Undid "${log.status.toLowerCase()}" for ${log.medication.name} (${formatClock(localClock(input.scheduledFor, input.timezone))} dose)`,
      },
      tx,
    );
  });
  return true;
}

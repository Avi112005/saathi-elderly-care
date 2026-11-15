"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { authorize, AuthorizationError } from "@/lib/server/session";
import { guarded } from "@/lib/server/guarded";
import { requiresConsent } from "@/lib/domain/permissions";
import { applyMedicationChange, describeChange, recordDose, undoDose } from "@/lib/server/medication-service";
import { logActivity } from "@/lib/server/audit";
import { deliver, getMailer, appUrl } from "@/lib/email/mailer";
import { changeRequestEmail } from "@/lib/email/templates";
import { doseLogSchema, fieldErrors, formToObject, medicationSchema, type MedicationInput } from "@/lib/validation/schemas";
import { fail, ok, type ActionState } from "@/lib/actions";
import type { ChangeKind } from "@/lib/domain/types";

function revalidateCare() {
  revalidatePath("/app", "layout");
}

/** Either applies the change or, under consent mode, files it for the elder's approval. */
async function submitChange(kind: ChangeKind, medicationId: string | null, input: MedicationInput | null): Promise<"applied" | "requested"> {
  const actor = await authorize("medication:edit");
  const elder = await prisma.member.findFirst({ where: { profileId: actor.profileId, role: "ELDER", active: true } });

  if (!requiresConsent(actor, actor.profile.consentMode, elder !== null)) {
    await applyMedicationChange(prisma, { kind, profileId: actor.profileId, medicationId, input, actorId: actor.id });
    return "applied";
  }

  const existing = medicationId ? await prisma.medication.findFirst({ where: { id: medicationId, profileId: actor.profileId } }) : null;
  if (medicationId && !existing) throw new AuthorizationError("That medicine is not part of this care circle.");
  const summary = describeChange(kind, input, existing);
  await prisma.changeRequest.create({
    data: { profileId: actor.profileId, kind, medicationId, payload: JSON.stringify(input), summary, requestedById: actor.id },
  });
  await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "request.created", summary: `${actor.name} asked to ${summary}` });

  if (elder?.email) {
    await deliver(prisma, getMailer(), {
      profileId: actor.profileId,
      memberId: elder.id,
      to: elder.email,
      kind: "CHANGE_REQUEST",
      dedupeKey: `change:${actor.profileId}:${Date.now()}:${elder.id}`,
      email: changeRequestEmail({ recipientName: elder.name, elderName: actor.profile.preferredName, toElder: true, appUrl: appUrl(), requester: actor.name, summary }),
    });
  }
  return "requested";
}

export async function saveMedication(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const parsed = medicationSchema.safeParse(formToObject(form, ["times", "daysOfWeek"]));
    if (!parsed.success) return fail("Some details need fixing.", fieldErrors(parsed.error));
    const id = String(form.get("id") ?? "") || null;
    const outcome = await submitChange(id ? "UPDATE" : "CREATE", id, parsed.data);
    revalidateCare();
    if (outcome === "requested") {
      return ok("Sent for approval. Nothing changes until the elder says yes.");
    }
    redirect("/app/medications?saved=1");
  });
}

export async function stopMedication(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const id = String(form.get("id") ?? "");
    if (!id) return fail("Missing medicine.");
    const outcome = await submitChange("ARCHIVE", id, null);
    revalidateCare();
    return ok(outcome === "requested" ? "Sent for approval — the elder will decide." : "Medicine stopped. Its history is kept.");
  });
}

const DOSE_ERRORS: Record<string, string> = {
  "not-found": "That medicine is no longer in the list.",
  "not-scheduled": "That dose isn't on the schedule.",
  "too-early": "That dose isn't due yet.",
  "too-old": "That dose is too old to change.",
};

export async function logDose(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("dose:log");
    const parsed = doseLogSchema.safeParse(formToObject(form));
    if (!parsed.success) return fail("Could not record that dose.");
    const result = await recordDose(prisma, {
      profileId: actor.profileId,
      timezone: actor.profile.timezone,
      actorId: actor.id,
      ...parsed.data,
    });
    if (!result.ok) return fail(DOSE_ERRORS[result.error] ?? "Could not record that dose.");
    revalidateCare();
    return ok(parsed.data.status === "TAKEN" ? "Marked as taken" : "Marked as skipped");
  });
}

export async function undoDoseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("dose:log");
    const medicationId = String(form.get("medicationId") ?? "");
    const at = new Date(String(form.get("scheduledFor") ?? ""));
    if (!medicationId || Number.isNaN(at.getTime())) return fail("Could not undo.");
    await undoDose(prisma, { profileId: actor.profileId, timezone: actor.profile.timezone, medicationId, scheduledFor: at, actorId: actor.id });
    revalidateCare();
    return ok("Undone");
  });
}

/** Quick stock top-up after a pharmacy run (doesn't need consent — it isn't a treatment change). */
export async function addStock(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("dose:log");
    const id = String(form.get("id") ?? "");
    const amount = Number(form.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) return fail("Enter how many units arrived (1–1000).");
    const med = await prisma.medication.findFirst({ where: { id, profileId: actor.profileId } });
    if (!med) return fail("Medicine not found.");
    await prisma.medication.update({ where: { id }, data: { stockCount: (med.stockCount ?? 0) + amount } });
    await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "medication.restocked", summary: `Added ${amount} to ${med.name} stock` });
    revalidateCare();
    return ok(`Stock updated: ${(med.stockCount ?? 0) + amount} on hand`);
  });
}

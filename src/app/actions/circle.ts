"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/db";
import { authorize } from "@/lib/server/session";
import { guarded } from "@/lib/server/guarded";
import { createInvite } from "@/lib/server/circle-service";
import { applyMedicationChange } from "@/lib/server/medication-service";
import { logActivity } from "@/lib/server/audit";
import { canManageMember } from "@/lib/domain/permissions";
import { isRole } from "@/lib/domain/types";
import { fieldErrors, formToObject, inviteSchema, medicationSchema } from "@/lib/validation/schemas";
import { fail, ok, type ActionState } from "@/lib/actions";

export async function inviteMember(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("circle:manage");
    const parsed = inviteSchema.safeParse(formToObject(form));
    if (!parsed.success) return fail("Check the invite details.", fieldErrors(parsed.error));
    const { code, expiresAt } = await createInvite(prisma, { profileId: actor.profileId, createdById: actor.id, ...parsed.data });
    await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "invite.created", summary: `Created a ${parsed.data.role.toLowerCase()} invite${parsed.data.label ? ` for ${parsed.data.label}` : ""}` });
    revalidatePath("/app/circle");
    return ok("Invite created. Share it now — it is shown only once.", { code, expiresAt: expiresAt.toISOString(), careCode: actor.profile.careCode });
  });
}

export async function revokeInvite(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("circle:manage");
    const id = String(form.get("id") ?? "");
    const res = await prisma.invite.updateMany({ where: { id, profileId: actor.profileId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (res.count === 0) return fail("Invite not found or already used.");
    await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "invite.revoked", summary: "Revoked an unused invite" });
    revalidatePath("/app/circle");
    return ok("Invite revoked");
  });
}

export async function updateMemberAccess(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("circle:manage");
    const id = String(form.get("id") ?? "");
    const intent = String(form.get("intent") ?? "");
    const target = await prisma.member.findFirst({ where: { id, profileId: actor.profileId, active: true } });
    if (!target || !isRole(target.role)) return fail("Member not found.");
    if (!canManageMember(actor, { id: target.id, role: target.role }, actor.id)) return fail("You can't change this member's access.");

    if (intent === "remove") {
      await prisma.$transaction([
        prisma.member.update({ where: { id }, data: { active: false } }),
        prisma.session.deleteMany({ where: { memberId: id } }),
      ]);
      await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "member.removed", summary: `Removed ${target.name} from the circle` });
      revalidatePath("/app/circle");
      return ok(`${target.name} no longer has access.`);
    }
    if (intent === "role") {
      const role = String(form.get("role") ?? "");
      if (role !== "CARETAKER" && role !== "FAMILY") return fail("Choose caretaker or family.");
      await prisma.member.update({ where: { id }, data: { role } });
      await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "member.role", summary: `${target.name} is now ${role.toLowerCase()}` });
      revalidatePath("/app/circle");
      return ok("Role updated");
    }
    if (intent === "unlock") {
      await prisma.member.update({ where: { id }, data: { lockedUntil: null, failedAttempts: 0 } });
      await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "member.unlocked", summary: `Unlocked ${target.name}'s access` });
      revalidatePath("/app/circle");
      return ok("Access unlocked");
    }
    return fail("Unknown action.");
  });
}

/** Consent mode: only the elder may switch it off; any admin may switch it on. */
export async function setConsentMode(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const enable = form.get("enable") === "true";
    const actor = await authorize(enable ? "circle:manage" : "consent:disable");
    const hasElder = await prisma.member.count({ where: { profileId: actor.profileId, role: "ELDER", active: true } });
    if (enable && hasElder === 0) return fail("Consent mode needs the elder to have their own sign-in first.");
    await prisma.careProfile.update({ where: { id: actor.profileId }, data: { consentMode: enable } });
    await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "consent.changed", summary: `${actor.name} turned consent mode ${enable ? "on" : "off"}` });
    revalidatePath("/app", "layout");
    return ok(enable ? "Consent mode is on." : "Consent mode is off.");
  });
}

/** The elder approves or declines a proposed medication change. */
export async function decideRequest(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("request:decide");
    const id = String(form.get("id") ?? "");
    const decision = String(form.get("decision") ?? "");
    if (decision !== "APPROVED" && decision !== "DECLINED") return fail("Choose approve or decline.");

    const request = await prisma.changeRequest.findFirst({ where: { id, profileId: actor.profileId, status: "PENDING" } });
    if (!request) return fail("That request was already decided.");

    let input = null;
    if (decision === "APPROVED" && request.kind !== "ARCHIVE") {
      // Re-validate the stored payload: rules may have changed since it was proposed.
      const parsed = medicationSchema.safeParse(reshapePayload(request.payload));
      if (!parsed.success) return fail("This request is no longer valid. Please ask for it to be re-sent.");
      input = parsed.data;
    }
    // Claim the request first so a double-click can never apply the change twice.
    const claimed = await prisma.changeRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: decision, decidedById: actor.id, decidedAt: new Date() },
    });
    if (claimed.count === 0) return fail("That request was already decided.");
    if (decision === "APPROVED") {
      await applyMedicationChange(prisma, { kind: request.kind as "CREATE" | "UPDATE" | "ARCHIVE", profileId: actor.profileId, medicationId: request.medicationId, input, actorId: actor.id, viaRequest: request.id });
    }
    await logActivity({ profileId: actor.profileId, actorId: actor.id, action: `request.${decision.toLowerCase()}`, summary: `${actor.name} ${decision === "APPROVED" ? "approved" : "declined"}: ${request.summary}` });
    revalidatePath("/app", "layout");
    return ok(decision === "APPROVED" ? "Approved — the change is live." : "Declined. Nothing was changed.");
  });
}

/** Stored payloads are parsed objects; the schema expects form-like strings for a few fields. */
function reshapePayload(raw: string): unknown {
  const value = JSON.parse(raw) as Record<string, unknown>;
  return {
    ...value,
    endDate: value.endDate ?? "",
    stockCount: value.stockCount === null || value.stockCount === undefined ? "" : String(value.stockCount),
  };
}

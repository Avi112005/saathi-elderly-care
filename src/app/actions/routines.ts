"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { authorize } from "@/lib/server/session";
import { guarded } from "@/lib/server/guarded";
import { recordRoutine, saveRoutine, stopRoutine, undoRoutine } from "@/lib/server/routine-service";
import { appUrl, getMailer } from "@/lib/email/mailer";
import { fieldErrors, formToObject, routineLogSchema, routineSchema } from "@/lib/validation/schemas";
import { fail, ok, warn, type ActionState } from "@/lib/actions";

export async function saveRoutineAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("routine:edit");
    const parsed = routineSchema.safeParse(formToObject(form, ["times", "daysOfWeek"]));
    if (!parsed.success) return fail("Some details need fixing.", fieldErrors(parsed.error));
    const id = String(form.get("id") ?? "") || null;
    try {
      await saveRoutine(prisma, { profileId: actor.profileId, actorId: actor.id, routineId: id, input: parsed.data });
    } catch {
      return fail("That routine could not be found.");
    }
    revalidatePath("/app", "layout");
    redirect("/app/routines?saved=1");
  });
}

export async function stopRoutineAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("routine:edit");
    const stopped = await stopRoutine(prisma, {
      profileId: actor.profileId,
      actorId: actor.id,
      routineId: String(form.get("id") ?? ""),
    });
    if (!stopped) return fail("Routine not found or already stopped.");
    revalidatePath("/app", "layout");
    return ok("Routine stopped. Past check-ins are kept.");
  });
}

export async function logRoutineAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("dose:log");
    const parsed = routineLogSchema.safeParse(formToObject(form));
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Could not save that.", fieldErrors(parsed.error));
    const result = await recordRoutine(prisma, getMailer(), {
      profileId: actor.profileId,
      timezone: actor.profile.timezone,
      elderName: actor.profile.preferredName,
      actorId: actor.id,
      actorName: actor.name,
      appUrl: appUrl(),
      input: parsed.data,
    });
    if (!result.ok) return fail(result.error);
    revalidatePath("/app", "layout");
    if (parsed.data.status === "SKIPPED") return ok("Marked as skipped");
    if (result.flag === "NORMAL") return ok(result.message ? `Saved. ${result.message}` : "Done — well done!");
    return warn(`${result.message}${result.alerted ? " The care circle has been emailed." : ""}`);
  });
}

export async function undoRoutineAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("dose:log");
    const at = new Date(String(form.get("scheduledFor") ?? ""));
    if (Number.isNaN(at.getTime())) return fail("Could not undo.");
    await undoRoutine(prisma, {
      profileId: actor.profileId,
      actorId: actor.id,
      routineId: String(form.get("routineId") ?? ""),
      scheduledFor: at,
    });
    revalidatePath("/app", "layout");
    return ok("Undone");
  });
}

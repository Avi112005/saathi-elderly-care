"use server";

import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { authorize } from "@/lib/server/session";
import { guarded } from "@/lib/server/guarded";
import { logActivity } from "@/lib/server/audit";
import { appointmentOutcomeSchema, appointmentSchema, fieldErrors, formToObject } from "@/lib/validation/schemas";
import { fail, ok, type ActionState } from "@/lib/actions";

export async function saveAppointment(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("appointment:edit");
    const parsed = appointmentSchema.safeParse(formToObject(form));
    if (!parsed.success) return fail("Some details need fixing.", fieldErrors(parsed.error));
    const { date, time, ...rest } = parsed.data;
    const startsAt = DateTime.fromISO(`${date}T${time}`, { zone: actor.profile.timezone });
    if (!startsAt.isValid) return fail("That date and time don't exist.", { time: ["Invalid time"] });

    const id = String(form.get("id") ?? "");
    if (id) {
      const existing = await prisma.appointment.findFirst({ where: { id, profileId: actor.profileId } });
      if (!existing) return fail("Appointment not found.");
      await prisma.appointment.update({ where: { id }, data: { ...rest, startsAt: startsAt.toJSDate() } });
      await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "appointment.updated", summary: `Updated "${rest.title}" (${startsAt.toFormat("d LLL, h:mm a")})` });
    } else {
      await prisma.appointment.create({ data: { ...rest, startsAt: startsAt.toJSDate(), profileId: actor.profileId, createdById: actor.id } });
      await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "appointment.created", summary: `Booked "${rest.title}" for ${startsAt.toFormat("d LLL, h:mm a")}` });
    }
    revalidatePath("/app", "layout");
    redirect("/app/appointments?saved=1");
  });
}

export async function recordOutcome(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("appointment:edit");
    const id = String(form.get("id") ?? "");
    const parsed = appointmentOutcomeSchema.safeParse(formToObject(form));
    if (!parsed.success) return fail("Some details need fixing.", fieldErrors(parsed.error));
    const existing = await prisma.appointment.findFirst({ where: { id, profileId: actor.profileId } });
    if (!existing) return fail("Appointment not found.");
    await prisma.appointment.update({ where: { id }, data: parsed.data });
    const verb = parsed.data.status === "COMPLETED" ? "Completed" : parsed.data.status === "CANCELLED" ? "Cancelled" : "Updated notes for";
    await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "appointment.outcome", summary: `${verb} "${existing.title}"` });
    revalidatePath("/app", "layout");
    return ok("Saved");
  });
}

/** Adds one question to the "ask the doctor" list — the elder's own agenda for the visit. */
export async function addQuestion(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await authorize("view");
    const id = String(form.get("id") ?? "");
    const question = String(form.get("question") ?? "").replace(/\s+/g, " ").trim();
    if (question.length < 3 || question.length > 200) return fail("Write a question of 3–200 characters.");
    const existing = await prisma.appointment.findFirst({ where: { id, profileId: actor.profileId } });
    if (!existing) return fail("Appointment not found.");
    const questions = [...existing.questions.split("\n").filter(Boolean), question].slice(-20).join("\n");
    await prisma.appointment.update({ where: { id }, data: { questions } });
    await logActivity({ profileId: actor.profileId, actorId: actor.id, action: "appointment.question", summary: `${actor.name} added a question for "${existing.title}"` });
    revalidatePath("/app", "layout");
    return ok("Question added");
  });
}

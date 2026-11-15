"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { authorize, destroySession, revokeOtherSessions } from "@/lib/server/session";
import { guarded } from "@/lib/server/guarded";
import { hashPasscode, verifyPasscode } from "@/lib/server/crypto";
import { limiters } from "@/lib/server/rate-limit";
import { logActivity } from "@/lib/server/audit";
import { runReminderSweep } from "@/lib/server/reminders";
import { appUrl, deliver, getMailer } from "@/lib/email/mailer";
import { testEmail } from "@/lib/email/templates";
import { changePinSchema, fieldErrors, formToObject, memberSettingsSchema, profileSchema } from "@/lib/validation/schemas";
import { A11Y_COOKIE, parseA11y, serializeA11y } from "@/lib/a11y";
import { fail, ok, type ActionState } from "@/lib/actions";

export async function updateMySettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const me = await authorize("view");
    const parsed = memberSettingsSchema.safeParse(formToObject(form));
    if (!parsed.success) return fail("Some settings need fixing.", fieldErrors(parsed.error));
    await prisma.member.update({ where: { id: me.id }, data: parsed.data });
    await logActivity({ profileId: me.profileId, actorId: me.id, action: "member.settings", summary: `${parsed.data.name} updated their notification settings` });
    revalidatePath("/app", "layout");
    return ok("Saved");
  });
}

export async function changePin(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const me = await authorize("view");
    const parsed = changePinSchema.safeParse(formToObject(form));
    if (!parsed.success) return fail("Check your PINs.", fieldErrors(parsed.error));
    const member = await prisma.member.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPasscode(parsed.data.currentPin, member.passcodeHash))) {
      return fail("Your current PIN is not right.", { currentPin: ["Incorrect PIN"] });
    }
    await prisma.member.update({ where: { id: me.id }, data: { passcodeHash: await hashPasscode(parsed.data.pin) } });
    const revoked = await revokeOtherSessions(me.id);
    await logActivity({ profileId: me.profileId, actorId: me.id, action: "security.pin", summary: `${me.name} changed their PIN` });
    return ok(`PIN changed.${revoked ? ` Signed out ${revoked} other device${revoked === 1 ? "" : "s"}.` : ""} Use the new PIN next time you sign in.`);
  });
}

export async function updateProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const me = await authorize("profile:edit");
    const parsed = profileSchema.safeParse(formToObject(form));
    if (!parsed.success) return fail("Some details need fixing.", fieldErrors(parsed.error));
    const { dateOfBirth, ...rest } = parsed.data;
    await prisma.careProfile.update({
      where: { id: me.profileId },
      data: { ...rest, dateOfBirth: dateOfBirth ? new Date(`${dateOfBirth}T00:00:00Z`) : null },
    });
    await logActivity({ profileId: me.profileId, actorId: me.id, action: "profile.updated", summary: `${me.name} updated ${rest.preferredName}'s health profile` });
    revalidatePath("/app", "layout");
    return ok("Health profile saved");
  });
}

export async function sendTestEmail(_prev: ActionState): Promise<ActionState> {
  return guarded(async () => {
    const me = await authorize("view");
    if (!me.email) return fail("Add your email address in Settings first.");
    if (!limiters.email.check(`email:${me.id}`).allowed) return fail("Please wait a few minutes before sending another.");
    const outcome = await deliver(prisma, getMailer(), {
      profileId: me.profileId,
      memberId: me.id,
      to: me.email,
      kind: "TEST",
      dedupeKey: `test:${me.id}:${Date.now()}`,
      email: testEmail({ recipientName: me.name, appUrl: appUrl() }),
    });
    revalidatePath("/app/outbox");
    if (outcome === "SENT") return ok(`Sent to ${me.email}. Check your inbox.`);
    if (outcome === "LOGGED") return ok("SMTP isn't configured, so the email was written to the Outbox instead of being sent.");
    return fail("The email server rejected the message. See the Outbox for details.");
  });
}

/** Runs the reminder engine for this circle right now (normally it runs every minute). */
export async function runRemindersNow(_prev: ActionState): Promise<ActionState> {
  return guarded(async () => {
    const me = await authorize("dose:log");
    if (!limiters.email.check(`sweep:${me.id}`).allowed) return fail("Please wait a few minutes before running again.");
    const r = await runReminderSweep({ db: prisma, mailer: getMailer(), profileId: me.profileId });
    revalidatePath("/app", "layout");
    const emails = r.emails.SENT + r.emails.LOGGED;
    return ok(
      emails + r.markedMissed === 0
        ? "Checked — nothing is due right now. Every reminder that was due has already gone out."
        : `Checked — ${emails} email${emails === 1 ? "" : "s"} queued${r.markedMissed ? `, ${r.markedMissed} dose${r.markedMissed === 1 ? "" : "s"} marked missed` : ""}.`,
    );
  });
}

/** Display preferences live in a cookie so the server renders the right size/contrast with no flash. */
export async function setDisplayPrefs(form: FormData): Promise<void> {
  const jar = await cookies();
  const current = parseA11y(jar.get(A11Y_COOKIE)?.value);
  const next = parseA11y(
    serializeA11y({
      textSize: (form.get("textSize") as string | null) ?? current.textSize,
      contrast: (form.get("contrast") as string | null) ?? current.contrast,
    } as typeof current),
  );
  jar.set(A11Y_COOKIE, serializeA11y(next), { path: "/", sameSite: "lax", maxAge: 365 * 86_400, httpOnly: false });
  revalidatePath("/", "layout");
}

/** Permanently deletes the care circle and all its data. Elder or admin only, with typed confirmation. */
export async function deleteCircle(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guarded(async () => {
    const me = await authorize("profile:edit");
    const typed = String(form.get("confirm") ?? "").trim();
    if (typed !== me.profile.preferredName) return fail(`Type "${me.profile.preferredName}" exactly to confirm.`, { confirm: ["Name does not match"] });
    if (me.profile.isDemo) return fail("The demo circle can't be deleted.");
    await prisma.careProfile.delete({ where: { id: me.profileId } });
    await destroySession();
    redirect("/?deleted=1");
  });
}

"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { clientIp, createSession, destroySession } from "@/lib/server/session";
import { limiters } from "@/lib/server/rate-limit";
import { authenticate, createCircle, redeemInvite } from "@/lib/server/circle-service";
import {
  careCodeSchema,
  createCircleSchema,
  fieldErrors,
  formToObject,
  joinSchema,
  loginSchema,
} from "@/lib/validation/schemas";
import { fail, type ActionState } from "@/lib/actions";
import { MINUTE_MS } from "@/lib/domain/time";

/** Only allow redirects to local app paths (prevents open redirects via ?next=). */
function safeNext(raw: unknown): string {
  return typeof raw === "string" && /^\/app(\/[\w\-/?=&#%.]*)?$/.test(raw) && !raw.startsWith("//") ? raw : "/app";
}

export async function findCircle(_prev: ActionState, form: FormData): Promise<ActionState> {
  const limit = limiters.lookup.check(`lookup:${await clientIp()}`);
  if (!limit.allowed) return fail(`Too many tries. Please wait ${Math.ceil(limit.retryAfterSec / 60)} minutes.`);
  const parsed = careCodeSchema.safeParse(form.get("careCode") ?? "");
  if (!parsed.success)
    return fail("Check the care code", { careCode: [parsed.error.issues[0]?.message ?? "Invalid code"] });
  const profile = await prisma.careProfile.findUnique({ where: { careCode: parsed.data }, select: { careCode: true } });
  if (!profile)
    return fail("We couldn't find a care circle with that code.", { careCode: ["No circle uses this code"] });
  const next = safeNext(form.get("next"));
  redirect(`/access/${profile.careCode}${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export async function signIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const limit = limiters.login.check(`login:${ip}`);
  if (!limit.allowed)
    return fail(`Too many attempts from this device. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.`);

  const parsed = loginSchema.safeParse(formToObject(form));
  if (!parsed.success) return fail("Please check your PIN.", fieldErrors(parsed.error));
  const circleLimit = limiters.circle.check(`circle:${parsed.data.careCode}`);
  if (!circleLimit.allowed)
    return fail(
      `This circle has had too many sign-in attempts. Try again in ${Math.ceil(circleLimit.retryAfterSec / 60)} minutes.`,
    );

  const result = await authenticate(prisma, parsed.data);
  if (!result.ok) {
    if (result.reason === "locked") {
      const minutes = Math.max(1, Math.ceil((result.retryAt.getTime() - Date.now()) / MINUTE_MS));
      return fail(
        `Too many wrong PINs. For safety, this profile is paused for ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      );
    }
    return fail(
      result.attemptsLeft <= 2
        ? `That PIN didn't match. ${result.attemptsLeft} tr${result.attemptsLeft === 1 ? "y" : "ies"} left before a short pause.`
        : "That PIN didn't match. Please try again.",
      { pin: ["Incorrect PIN"] },
    );
  }
  limiters.login.reset(`login:${ip}`);
  await createSession(result.memberId);
  redirect(safeNext(form.get("next")));
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function startCircle(_prev: ActionState, form: FormData): Promise<ActionState> {
  const limit = limiters.signup.check(`signup:${await clientIp()}`);
  if (!limit.allowed) return fail("Too many new circles from this device. Please try again later.");
  const parsed = createCircleSchema.safeParse(formToObject(form));
  if (!parsed.success) return fail("A few details need fixing.", fieldErrors(parsed.error));

  const { profile, member } = await createCircle(prisma, parsed.data);
  await createSession(member.id);
  redirect(`/app/welcome?code=${encodeURIComponent(profile.careCode)}`);
}

export async function joinCircle(_prev: ActionState, form: FormData): Promise<ActionState> {
  const limit = limiters.signup.check(`join:${await clientIp()}`);
  if (!limit.allowed) return fail("Too many attempts. Please try again later.");
  const parsed = joinSchema.safeParse(formToObject(form));
  if (!parsed.success) return fail("A few details need fixing.", fieldErrors(parsed.error));

  const result = await redeemInvite(prisma, parsed.data);
  if (!result.ok) return fail(result.message, { inviteCode: [result.message] });
  await createSession(result.memberId);
  redirect("/app");
}

import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { generateToken, sha256 } from "./crypto";
import { can, type Action } from "@/lib/domain/permissions";
import { isRole, type Role } from "@/lib/domain/types";
import { sessionCookieName } from "@/lib/session-cookie";
import { DAY_MS, MINUTE_MS } from "@/lib/domain/time";

export const SESSION_COOKIE = sessionCookieName();
const SESSION_DAYS = 14;

/** Creates a database-backed session and sets the httpOnly cookie. */
export async function createSession(memberId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  const userAgent = ((await headers()).get("user-agent") ?? "").slice(0, 200);
  await prisma.session.create({ data: { tokenHash: sha256(token), memberId, expiresAt, userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/**
 * Signs a member out everywhere except this browser — used after a PIN change so a
 * device that learned the old PIN loses access immediately.
 */
export async function revokeOtherSessions(memberId: string): Promise<number> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const keep = token ? sha256(token) : "";
  const { count } = await prisma.session.deleteMany({ where: { memberId, tokenHash: { not: keep } } });
  return count;
}

export interface CurrentMember {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  isAdmin: boolean;
  profileId: string;
  profile: {
    id: string;
    careCode: string;
    fullName: string;
    preferredName: string;
    timezone: string;
    consentMode: boolean;
    isDemo: boolean;
  };
}

/**
 * Resolves the signed-in member from the session cookie. Memoised per request with
 * React `cache`, so layouts and pages share one database lookup.
 */
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      member: {
        include: {
          profile: {
            select: {
              id: true,
              careCode: true,
              fullName: true,
              preferredName: true,
              timezone: true,
              consentMode: true,
              isDemo: true,
            },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.member.active) return null;

  const m = session.member;
  const role = m.role;
  if (!isRole(role)) return null;
  // Throttled "last seen" so the circle page can show who is active without a write per request.
  if (!m.lastSeenAt || Date.now() - m.lastSeenAt.getTime() > 5 * MINUTE_MS) {
    await prisma.member.update({ where: { id: m.id }, data: { lastSeenAt: new Date() } });
  }
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role,
    isAdmin: m.isAdmin,
    profileId: m.profileId,
    profile: m.profile,
  };
});

/** For pages: redirects to the access screen when nobody is signed in. */
export async function requireMember(): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) redirect("/access");
  return member;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions: returns the member if they may perform `action`, otherwise throws. */
export async function authorize(action: Action): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) throw new AuthorizationError("Your session has ended. Please sign in again.");
  if (!can(member, action)) throw new AuthorizationError();
  return member;
}

/** Best-effort client IP for rate limiting (trusts the first proxy hop). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

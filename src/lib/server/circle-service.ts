import type { PrismaClient } from "@prisma/client";
import { generateCareCode, generateInviteCode, hashPasscode, sha256, verifyPasscode } from "./crypto";
import { logActivity } from "./audit";
import type { Role } from "@/lib/domain/types";
import type { z } from "zod";
import type { createCircleSchema, joinSchema } from "@/lib/validation/schemas";
import { HOUR_MS, MINUTE_MS } from "@/lib/domain/time";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const INVITE_TTL_HOURS = 72;

const AVATAR_COLORS = ["sky", "marigold", "sage", "rose", "amber", "violet"] as const;

/**
 * A fixed hash used when the member does not exist, so a wrong member id costs the
 * same scrypt time as a wrong PIN (no timing oracle for valid member ids).
 */
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPasscode("000000-dummy"));

export async function uniqueCareCode(db: PrismaClient): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCareCode();
    if (!(await db.careProfile.findUnique({ where: { careCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not allocate a unique care code");
}

/**
 * Creates a care circle. When an elder sets it up themselves they become the elder
 * member; when a relative sets it up for them, the relative becomes an admin family
 * member and (optionally) an elder member is created with their own PIN.
 */
export async function createCircle(db: PrismaClient, input: z.infer<typeof createCircleSchema>) {
  const careCode = await uniqueCareCode(db);
  const self = input.setupFor === "SELF";
  const creatorHash = await hashPasscode(input.pin);
  const elderHash = !self && input.elderPin ? await hashPasscode(input.elderPin) : null;

  return db.$transaction(async (tx) => {
    const profile = await tx.careProfile.create({
      data: {
        careCode,
        fullName: input.elderFullName,
        preferredName: input.elderPreferredName,
        dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00Z`) : null,
        timezone: input.timezone,
        conditions: input.conditions,
        allergies: input.allergies,
        // Consent only makes sense when the elder can sign in to give it.
        consentMode: input.consentMode && (self || elderHash !== null),
      },
    });

    const creator = await tx.member.create({
      data: {
        profileId: profile.id,
        name: self ? input.elderPreferredName : input.yourName,
        email: input.email,
        relationship: self ? "Self" : input.relationship,
        role: self ? "ELDER" : "FAMILY",
        isAdmin: true,
        passcodeHash: creatorHash,
        avatarColor: self ? "marigold" : "sky",
        emailDoseReminders: self,
        emailDailyDigest: !self,
      },
    });

    if (elderHash) {
      await tx.member.create({
        data: {
          profileId: profile.id,
          name: input.elderPreferredName,
          email: input.elderEmail ?? null,
          relationship: "Self",
          role: "ELDER",
          isAdmin: true,
          passcodeHash: elderHash,
          avatarColor: "marigold",
        },
      });
    }

    await logActivity(
      {
        profileId: profile.id,
        actorId: creator.id,
        action: "circle.created",
        summary: `${creator.name} created the care circle for ${profile.preferredName}`,
      },
      tx,
    );
    return { profile, member: creator };
  });
}

export type AuthResult =
  | { ok: true; memberId: string }
  | { ok: false; reason: "invalid"; attemptsLeft: number }
  | { ok: false; reason: "locked"; retryAt: Date };

/** Verifies a member's PIN with per-member lockout after repeated failures. */
export async function authenticate(
  db: PrismaClient,
  input: { careCode: string; memberId: string; pin: string },
  now: Date = new Date(),
): Promise<AuthResult> {
  const member = await db.member.findFirst({
    where: { id: input.memberId, active: true, profile: { careCode: input.careCode } },
  });
  if (!member) {
    await verifyPasscode(input.pin, await getDummyHash());
    return { ok: false, reason: "invalid", attemptsLeft: MAX_FAILED_ATTEMPTS };
  }
  if (member.lockedUntil && member.lockedUntil > now) {
    return { ok: false, reason: "locked", retryAt: member.lockedUntil };
  }

  if (await verifyPasscode(input.pin, member.passcodeHash)) {
    await db.member.update({
      where: { id: member.id },
      data: { failedAttempts: 0, lockedUntil: null, lastSeenAt: now },
    });
    return { ok: true, memberId: member.id };
  }

  const failed = member.failedAttempts + 1;
  if (failed >= MAX_FAILED_ATTEMPTS) {
    const retryAt = new Date(now.getTime() + LOCKOUT_MINUTES * MINUTE_MS);
    await db.member.update({ where: { id: member.id }, data: { failedAttempts: 0, lockedUntil: retryAt } });
    await logActivity(
      {
        profileId: member.profileId,
        actorId: null,
        action: "security.lockout",
        summary: `${member.name}'s access was paused for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} wrong PINs`,
      },
      db,
    );
    return { ok: false, reason: "locked", retryAt };
  }
  await db.member.update({ where: { id: member.id }, data: { failedAttempts: failed } });
  return { ok: false, reason: "invalid", attemptsLeft: MAX_FAILED_ATTEMPTS - failed };
}

/** Creates a one-time invite. Returns the plain code exactly once; only its hash is stored. */
export async function createInvite(
  db: PrismaClient,
  input: { profileId: string; role: Exclude<Role, "ELDER">; label: string; createdById: string },
  now: Date = new Date(),
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateInviteCode();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_HOURS * HOUR_MS);
  await db.invite.create({
    data: {
      profileId: input.profileId,
      codeHash: sha256(code),
      role: input.role,
      label: input.label,
      createdById: input.createdById,
      expiresAt,
    },
  });
  return { code, expiresAt };
}

export type RedeemResult = { ok: true; memberId: string; profileId: string } | { ok: false; message: string };

/** Turns a valid invite into a new member. Single use: the invite is consumed atomically. */
export async function redeemInvite(
  db: PrismaClient,
  input: z.infer<typeof joinSchema>,
  now: Date = new Date(),
): Promise<RedeemResult> {
  const invite = await db.invite.findUnique({ where: { codeHash: sha256(input.inviteCode) } });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= now) {
    return { ok: false, message: "That invite code is not valid any more. Ask for a new one." };
  }
  const passcodeHash = await hashPasscode(input.pin);
  const memberCount = await db.member.count({ where: { profileId: invite.profileId } });

  return db.$transaction(async (tx) => {
    // Conditional update = atomic claim; a second concurrent redemption updates 0 rows.
    const claimed = await tx.invite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) return { ok: false as const, message: "That invite code has already been used." };
    const member = await tx.member.create({
      data: {
        profileId: invite.profileId,
        name: input.name,
        email: input.email,
        relationship: input.relationship,
        role: invite.role,
        passcodeHash,
        avatarColor: AVATAR_COLORS[memberCount % AVATAR_COLORS.length],
        emailDoseReminders: invite.role === "CARETAKER",
        emailDailyDigest: invite.role === "FAMILY",
      },
    });
    await logActivity(
      {
        profileId: invite.profileId,
        actorId: member.id,
        action: "member.joined",
        summary: `${member.name} joined as ${invite.role.toLowerCase()}`,
      },
      tx,
    );
    return { ok: true as const, memberId: member.id, profileId: invite.profileId };
  });
}

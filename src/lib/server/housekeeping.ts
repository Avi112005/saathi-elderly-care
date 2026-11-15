import type { PrismaClient } from "@prisma/client";

/** How long sent-email records are kept before being purged (data minimisation). */
export const OUTBOX_RETENTION_DAYS = 180;

/**
 * Deletes data that is no longer needed: expired sessions, invites that can no longer
 * be used, and old outbox entries. Runs alongside the reminder sweep.
 */
export async function purgeExpired(db: PrismaClient, now: Date = new Date()) {
  const dayMs = 86_400_000;
  const [sessions, invites, notifications] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.invite.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 7 * dayMs) } }, { revokedAt: { not: null } }, { usedAt: { not: null } }] } }),
    db.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - OUTBOX_RETENTION_DAYS * dayMs) } } }),
  ]);
  return { sessions: sessions.count, invites: invites.count, notifications: notifications.count };
}

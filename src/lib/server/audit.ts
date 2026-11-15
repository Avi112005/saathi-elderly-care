import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Appends to the care circle's activity log. Every change to medicines, doses,
 * appointments and membership goes through here so the circle can always answer
 * "who changed this, and when?".
 */
export async function logActivity(
  entry: { profileId: string; actorId: string | null; action: string; summary: string },
  db: Db = prisma,
): Promise<void> {
  await db.activityLog.create({
    data: {
      profileId: entry.profileId,
      actorId: entry.actorId,
      action: entry.action,
      summary: entry.summary.slice(0, 300),
    },
  });
}

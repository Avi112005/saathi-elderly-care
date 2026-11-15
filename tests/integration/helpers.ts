import { PrismaClient } from "@prisma/client";
import { vi } from "vitest";
import type { Mailer } from "@/lib/email/mailer";
import { generateCareCode } from "@/lib/server/crypto";

/** Uses the throwaway database created by tests/global-setup.ts (DATABASE_URL=file:./test.db). */
export const db = new PrismaClient();

export async function resetDb() {
  // Child tables first; cascades handle the rest.
  await db.notification.deleteMany();
  await db.activityLog.deleteMany();
  await db.careProfile.deleteMany();
}

export function fakeMailer(live = true): Mailer & { send: ReturnType<typeof vi.fn> } {
  return { live, send: vi.fn(async () => undefined) };
}

/** A circle in UTC with an elder, a caretaker and a family member, all with email. */
export async function makeCircle(opts: { consentMode?: boolean } = {}) {
  const profile = await db.careProfile.create({
    data: { careCode: generateCareCode(), fullName: "Kamala Sharma", preferredName: "Kamala", timezone: "UTC", consentMode: opts.consentMode ?? false },
  });
  const hash = "scrypt$32768$8$1$AAAA$AAAA";
  const elder = await db.member.create({ data: { profileId: profile.id, name: "Kamala", email: "kamala@example.com", role: "ELDER", isAdmin: true, passcodeHash: hash } });
  const caretaker = await db.member.create({ data: { profileId: profile.id, name: "Priya", email: "priya@example.com", role: "CARETAKER", passcodeHash: hash } });
  const family = await db.member.create({
    data: { profileId: profile.id, name: "Rahul", email: "rahul@example.com", role: "FAMILY", passcodeHash: hash, emailDoseReminders: false, emailDailyDigest: true },
  });
  return { profile, elder, caretaker, family };
}

export async function addMed(profileId: string, over: Partial<{ name: string; times: string; stockCount: number | null; refillAt: number; createdAt: Date; scheduleChangedAt: Date }> = {}) {
  // Medicines "exist" from the start of the test day, so earlier days never escalate.
  const past = new Date("2026-03-10T00:00:00.000Z");
  return db.medication.create({
    data: {
      profileId,
      name: over.name ?? "Metformin",
      strength: "500 mg",
      times: over.times ?? "08:00",
      startDate: "2026-01-01",
      stockCount: over.stockCount ?? null,
      refillAt: over.refillAt ?? 7,
      createdAt: over.createdAt ?? past,
      scheduleChangedAt: over.scheduleChangedAt ?? past,
    },
  });
}

export const utc = (iso: string) => new Date(`${iso}Z`);

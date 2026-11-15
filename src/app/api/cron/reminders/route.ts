import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { runReminderSweep } from "@/lib/server/reminders";
import { purgeExpired } from "@/lib/server/housekeeping";
import { getMailer } from "@/lib/email/mailer";

export const dynamic = "force-dynamic";
/** A sweep of many circles can take a few seconds; allow up to a minute on serverless hosts. */
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * External trigger for the reminder engine (Supabase pg_cron, Vercel Cron, cron-job.org…).
 * Requires `Authorization: Bearer $CRON_SECRET`. Idempotent — safe to call every minute.
 */
async function handle(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReminderSweep({ db: prisma, mailer: getMailer() });
  const purged = await purgeExpired(prisma);
  return NextResponse.json({ ok: true, ...result, purged });
}

export const GET = handle;
export const POST = handle;

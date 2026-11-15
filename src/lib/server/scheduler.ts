import { prisma } from "./db";
import { runReminderSweep } from "./reminders";
import { purgeExpired } from "./housekeeping";
import { getMailer } from "@/lib/email/mailer";

const INTERVAL_MS = 60_000;
const state = globalThis as unknown as { __saathiScheduler?: { timer: NodeJS.Timeout; running: boolean; lastPurge: number } };

/**
 * In-process scheduler for long-running Node deployments. Runs one sweep a minute and
 * never overlaps runs. Serverless hosts should set REMINDER_SCHEDULER=off and call
 * POST /api/cron/reminders from their cron instead — the sweep is idempotent either way.
 */
export function startReminderScheduler(): void {
  if (state.__saathiScheduler) return;
  const tick = async () => {
    const s = state.__saathiScheduler;
    if (!s || s.running) return;
    s.running = true;
    try {
      const r = await runReminderSweep({ db: prisma, mailer: getMailer() });
      // Housekeeping once an hour is plenty.
      if (Date.now() - s.lastPurge > 3_600_000) {
        s.lastPurge = Date.now();
        await purgeExpired(prisma);
      }
      const sent = r.emails.SENT + r.emails.LOGGED;
      if (sent > 0 || r.markedMissed > 0 || r.emails.FAILED > 0) {
        console.info(`[reminders] ${sent} email(s), ${r.markedMissed} dose(s) marked missed, ${r.emails.FAILED} failed`);
      }
    } catch (err) {
      console.error("[reminders] sweep failed", err);
    } finally {
      s.running = false;
    }
  };
  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref();
  state.__saathiScheduler = { timer, running: false, lastPurge: 0 };
  setTimeout(tick, 5_000).unref();
  console.info("[reminders] scheduler started (every 60s)");
}

/**
 * Next.js boot hook: starts the in-process reminder scheduler on long-running Node
 * servers. Serverless platforms (Vercel) freeze between requests, so there the
 * scheduler stays off and an external cron calls /api/cron/reminders instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.REMINDER_SCHEDULER === "off" || process.env.VERCEL || process.env.NODE_ENV === "test") return;
  const { startReminderScheduler } = await import("./lib/server/scheduler");
  startReminderScheduler();
}

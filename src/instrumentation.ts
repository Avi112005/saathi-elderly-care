/** Next.js boot hook: starts the reminder scheduler on the Node.js server runtime. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.REMINDER_SCHEDULER === "off" || process.env.NODE_ENV === "test") return;
  const { startReminderScheduler } = await import("./lib/server/scheduler");
  startReminderScheduler();
}

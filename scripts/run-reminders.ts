/**
 * Runs one reminder sweep from the command line — handy for system cron on a VPS:
 *   * * * * * cd /srv/saathi && npm run reminders:run
 */
import { prisma } from "../src/lib/server/db";
import { runReminderSweep } from "../src/lib/server/reminders";
import { getMailer } from "../src/lib/email/mailer";

runReminderSweep({ db: prisma, mailer: getMailer() })
  .then((r) => console.info(JSON.stringify(r)))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { getMailer } from "@/lib/email/mailer";
import { maskEmail } from "@/lib/domain/format";
import { RunRemindersButton, TestEmailButton } from "@/components/app/action-forms";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Email outbox" };

const KIND_LABEL: Record<string, string> = {
  DOSE_UPCOMING: "Dose reminder",
  DOSE_NUDGE: "Dose nudge",
  DOSE_MISSED: "Missed dose",
  APPOINTMENT: "Appointment",
  REFILL: "Refill",
  DAILY_DIGEST: "Daily digest",
  CHANGE_REQUEST: "Approval request",
  TEST: "Test",
};
const STATUS_TONE = { SENT: "sage", LOGGED: "sky", FAILED: "rose", QUEUED: "amber" } as const;

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const member = await requireMember();
  const { id } = await searchParams;
  const zone = member.profile.timezone;
  const [emails, selected] = await Promise.all([
    prisma.notification.findMany({
      where: { profileId: member.profileId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, kind: true, subject: true, toEmail: true, status: true, createdAt: true, memberId: true },
    }),
    id ? prisma.notification.findFirst({ where: { id, profileId: member.profileId } }) : null,
  ]);
  const live = getMailer().live;
  // People only see their own address in full.
  const showTo = (memberId: string | null, to: string) => (memberId === member.id ? to : maskEmail(to));

  return (
    <>
      <PageHeader
        eyebrow="Reminders & alerts"
        title="Email outbox"
        description="Every email Saathi has sent for this circle. The reminder engine runs every minute; each email is sent exactly once."
      />
      <Card className="mb-8 flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <p className="flex items-center gap-2 font-semibold">
            <span className={`size-2.5 rounded-full ${live ? "bg-sage" : "bg-marigold-400"}`} aria-hidden="true" />
            {live ? "Email delivery is live (SMTP connected)" : "Preview mode — SMTP isn't configured"}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {live
              ? "Emails are delivered to each member's inbox."
              : "Emails are written here instead of being sent. Add SMTP settings to .env to deliver them for real."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <RunRemindersButton />
          <TestEmailButton />
        </div>
      </Card>

      {selected && (
        <section aria-labelledby="preview-title" className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="preview-title" className="text-2xl">
              {selected.subject}
            </h2>
            <Link href="/app/outbox" className="ink-underline text-sm font-semibold">
              Close preview
            </Link>
          </div>
          {/* Sandboxed: no scripts, no same-origin access. Content is also escaped at render time. */}
          <iframe
            title={`Email preview: ${selected.subject}`}
            srcDoc={selected.bodyHtml}
            sandbox=""
            className="h-[36rem] w-full rounded-2xl border border-line bg-paper"
          />
        </section>
      )}

      {emails.length === 0 ? (
        <Card className="p-6 text-ink-2">No emails yet. They appear as doses and appointments come due.</Card>
      ) : (
        <div
          className="card overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Sent emails table (scrolls sideways)"
        >
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Emails sent for this care circle</caption>
            <thead className="border-b border-line bg-paper-2 text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  When
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Subject
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  To
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {emails.map((e) => (
                <tr key={e.id} className={e.id === id ? "bg-sky-50" : ""}>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-2">
                    {DateTime.fromJSDate(e.createdAt, { zone }).toFormat("d LLL, h:mm a")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{KIND_LABEL[e.kind] ?? e.kind}</td>
                  <td className="px-4 py-3">
                    <Link href={`/app/outbox?id=${e.id}#preview-title`} className="ink-underline font-semibold">
                      {e.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{showTo(e.memberId, e.toEmail)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[e.status as keyof typeof STATUS_TONE] ?? "ink"}>
                      {e.status === "LOGGED" ? "Preview" : e.status.toLowerCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <Icon name="info" className="size-4" /> Each person controls which emails they get in Settings → Notifications.
      </p>
    </>
  );
}

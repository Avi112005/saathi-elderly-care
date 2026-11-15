import type { Metadata } from "next";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { Avatar, Card, PageHeader } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 50;

function iconFor(action: string): IconName {
  if (action.startsWith("dose.")) return "check";
  if (action.startsWith("medication.")) return "pill";
  if (action.startsWith("appointment.")) return "calendar";
  if (action.startsWith("request.") || action.startsWith("consent.")) return "heart";
  if (action.startsWith("security.")) return "lock";
  if (action.startsWith("member.") || action.startsWith("invite.") || action.startsWith("circle.")) return "users";
  return "activity";
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const member = await requireMember();
  const page = Math.max(1, Math.min(100, Number((await searchParams).page) || 1));
  const zone = member.profile.timezone;
  const entries = await prisma.activityLog.findMany({
    where: { profileId: member.profileId },
    include: { actor: { select: { name: true, avatarColor: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  const hasMore = entries.length > PAGE_SIZE;

  const groups = new Map<string, typeof entries>();
  for (const e of entries.slice(0, PAGE_SIZE)) {
    const day = DateTime.fromJSDate(e.createdAt, { zone }).toFormat("cccc d LLLL");
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Audit trail"
        title="Activity"
        description="Every change anyone makes is recorded here — who, what and when. Nothing can be edited or deleted."
      />
      {groups.size === 0 && <Card className="p-6 text-ink-2">No activity yet.</Card>}
      <div className="flex flex-col gap-8">
        {[...groups.entries()].map(([day, list]) => (
          <section key={day} aria-label={day}>
            <h2 className="mb-3 font-hand text-2xl text-sky-600">{day}</h2>
            <ol className="card divide-y divide-line">
              {list.map((e) => (
                <li key={e.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                  {e.actor ? (
                    <Avatar name={e.actor.name} color={e.actor.avatarColor} size="sm" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full bg-paper-3 text-ink-2">
                      <Icon name={iconFor(e.action)} className="size-4" />
                    </span>
                  )}
                  <p className="min-w-0 flex-1">{e.summary}</p>
                  <time dateTime={e.createdAt.toISOString()} className="shrink-0 text-sm text-ink-2">
                    {DateTime.fromJSDate(e.createdAt, { zone }).toFormat("h:mm a")}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <nav aria-label="Pagination" className="mt-8 flex justify-between">
        {page > 1 ? (
          <a className="ink-underline font-semibold" href={`?page=${page - 1}`}>
            ← Newer
          </a>
        ) : (
          <span />
        )}
        {hasMore && (
          <a className="ink-underline font-semibold" href={`?page=${page + 1}`}>
            Older →
          </a>
        )}
      </nav>
    </>
  );
}

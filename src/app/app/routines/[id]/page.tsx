import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { parseDays, parseTimes } from "@/lib/domain/schedule";
import { formatReading, ROUTINE_KIND_LABEL, toRoutineKind } from "@/lib/domain/vitals";
import { RoutineForm, StopRoutineButton } from "@/components/app/routine-form";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Routine" };

const FLAG_TONE = { NORMAL: "sage", LOW: "amber", HIGH: "amber", URGENT: "rose" } as const;

export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMember();
  const routine = await prisma.routine.findFirst({
    where: { id, profileId: member.profileId },
    include: {
      logs: { orderBy: { scheduledFor: "desc" }, take: 20, include: { loggedBy: { select: { name: true } } } },
    },
  });
  if (!routine) notFound();
  const kind = toRoutineKind(routine.kind);
  const zone = member.profile.timezone;
  const editable = can(member, "routine:edit") && routine.active;

  return (
    <>
      <PageHeader
        eyebrow={routine.active ? ROUTINE_KIND_LABEL[kind] : "Stopped routine"}
        title={routine.title}
        description={routine.notes || undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {editable ? (
            <Card className="p-5 sm:p-8">
              <h2 className="mb-6 text-2xl">Edit</h2>
              <RoutineForm
                initial={{
                  id: routine.id,
                  title: routine.title,
                  kind: routine.kind,
                  times: parseTimes(routine.times),
                  daysOfWeek: parseDays(routine.daysOfWeek),
                  startDate: routine.startDate,
                  endDate: routine.endDate ?? "",
                  notes: routine.notes,
                }}
              />
            </Card>
          ) : (
            <Card className="p-5 text-ink-2">
              {routine.active ? "You can view this routine." : "This routine was stopped. Its history is kept."}
            </Card>
          )}
        </div>
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">Recent check-ins</h2>
            {routine.logs.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">Nothing recorded yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {routine.logs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span>
                      {DateTime.fromJSDate(l.scheduledFor, { zone }).toFormat("d LLL, h:mm a")}
                      {l.loggedBy && <span className="text-ink-2"> · {l.loggedBy.name}</span>}
                    </span>
                    {l.status === "SKIPPED" ? (
                      <Badge tone="ink">skipped</Badge>
                    ) : (
                      <Badge tone={FLAG_TONE[l.flag as keyof typeof FLAG_TONE] ?? "sage"}>
                        {formatReading(kind, l) || "done"}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {editable && (
            <Card className="p-5">
              <h2 className="mb-3 font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">Stop</h2>
              <StopRoutineButton id={routine.id} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

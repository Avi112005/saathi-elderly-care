import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { describeDays, parseTimes } from "@/lib/domain/schedule";
import { formatClock } from "@/lib/domain/time";
import { formatReading, ROUTINE_KIND_LABEL, type RoutineKind } from "@/lib/domain/vitals";
import { RoutineForm } from "@/components/app/routine-form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Routines" };

export default async function RoutinesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const member = await requireMember();
  const { saved } = await searchParams;
  const routines = await prisma.routine.findMany({
    where: { profileId: member.profileId, active: true },
    include: { logs: { where: { status: "DONE" }, orderBy: { scheduledFor: "desc" }, take: 1 } },
    orderBy: { title: "asc" },
  });
  const zone = member.profile.timezone;
  const editable = can(member, "routine:edit");

  return (
    <>
      <PageHeader
        eyebrow="Daily healthcare"
        title="Routines"
        description="The healthy habits and home checks around the medicines — blood pressure, sugar, walks, physiotherapy. Readings are checked against safe ranges and the circle is told if one is out of range."
      />
      {saved && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-sage-100 bg-sage-100/70 px-4 py-3 text-sage-700">
          <Icon name="check" className="size-5" /> Saved. It now appears on the Today screen.
        </p>
      )}

      {routines.length === 0 ? (
        <EmptyState icon="heartPulse" title="No routines yet">
          Add a blood-pressure check, a sugar test or a daily walk — Saathi reminds, records and spots worrying readings.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {routines.map((r) => {
            const kind = r.kind as RoutineKind;
            const last = r.logs[0];
            const reading = last ? formatReading(kind, last) : "";
            return (
              <li key={r.id}>
                <Link href={`/app/routines/${r.id}`} className="card flex h-full gap-4 p-5 transition-colors hover:border-sky-300">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700">
                    <Icon name={kind === "ACTIVITY" ? "walk" : "heartPulse"} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold">{r.title}</span>
                    <span className="block text-sm text-ink-2">
                      {ROUTINE_KIND_LABEL[kind]} · {parseTimes(r.times).map(formatClock).join(", ")} · {describeDays(r.daysOfWeek)}
                    </span>
                    {last && (
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        Last: {reading || "done"} · {DateTime.fromJSDate(last.scheduledFor, { zone }).toRelative()}
                        {last.flag !== "NORMAL" && <Badge tone={last.flag === "URGENT" ? "rose" : "amber"}>{last.flag.toLowerCase()}</Badge>}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <section aria-labelledby="add-routine" className="mt-10">
          <h2 id="add-routine" className="mb-3 text-3xl">Add a routine</h2>
          <Card className="p-5 sm:p-8">
            <RoutineForm
              initial={{ title: "", kind: "ACTIVITY", times: ["08:00"], daysOfWeek: [1, 2, 3, 4, 5, 6, 7], startDate: DateTime.now().setZone(zone).toISODate() ?? "", endDate: "", notes: "" }}
            />
          </Card>
        </section>
      )}
    </>
  );
}

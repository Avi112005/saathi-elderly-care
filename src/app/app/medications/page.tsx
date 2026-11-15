import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { safetyFindings } from "@/lib/server/queries";
import { can } from "@/lib/domain/permissions";
import { describeDays, forecastRefill, parseTimes } from "@/lib/domain/schedule";
import { formatClock } from "@/lib/domain/time";
import { formatDose, pluralise } from "@/lib/domain/format";
import { FOOD_TIMING_LABEL, type FoodTiming } from "@/lib/domain/types";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";
import { SafetyList } from "@/components/app/safety-list";
import { PILL_SWATCH } from "@/components/app/dose-card";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Medicines" };

export default async function MedicationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const member = await requireMember();
  const { saved } = await searchParams;
  const [meds, profile] = await Promise.all([
    prisma.medication.findMany({ where: { profileId: member.profileId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.careProfile.findUniqueOrThrow({ where: { id: member.profileId }, select: { allergies: true, dateOfBirth: true } }),
  ]);
  const active = meds.filter((m) => m.active);
  const findings = safetyFindings(profile, active);
  const stopped = meds.filter((m) => !m.active);
  const zone = member.profile.timezone;
  const editable = can(member, "medication:edit");

  return (
    <>
      <PageHeader
        eyebrow={`${pluralise(active.length, "active medicine")}`}
        title="Medicines"
        description="Every medicine, when it's taken, what it's for and how much is left."
        actions={editable ? <ButtonLink href="/app/medications/new" icon="plus">Add medicine</ButtonLink> : undefined}
      />
      {saved && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-sage-100 bg-sage-100/70 px-4 py-3 text-sage-700">
          <Icon name="check" className="size-5" /> Saved. Reminders now follow the new schedule.
        </p>
      )}

      {active.length === 0 ? (
        <EmptyState icon="pill" title="No active medicines" action={editable ? <ButtonLink href="/app/medications/new" icon="plus">Add a medicine</ButtonLink> : undefined}>
          Add each medicine once, and Saathi takes care of every reminder.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {active.map((m) => {
            const forecast = forecastRefill(m, zone);
            return (
              <li key={m.id}>
                <Link href={`/app/medications/${m.id}`} className="card flex h-full gap-4 p-5 transition-colors hover:border-sky-300">
                  <span aria-hidden="true" className="mt-1 h-6 w-11 shrink-0 rounded-full border border-line-2 shadow-inner" style={{ background: PILL_SWATCH[m.pillColor] ?? "#fff" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold leading-snug">
                      {m.name} <span className="font-normal text-ink-2">{m.strength}</span>
                    </span>
                    <span className="block text-sm text-ink-2">
                      {formatDose(m.doseQuantity, m.doseUnit)} · {parseTimes(m.times).map(formatClock).join(", ")} · {describeDays(m.daysOfWeek)}
                    </span>
                    {m.purpose && <span className="mt-1 block text-sm">For {m.purpose.toLowerCase()}</span>}
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {m.foodTiming !== "ANY" && <Badge tone="sky">{FOOD_TIMING_LABEL[m.foodTiming as FoodTiming]}</Badge>}
                      {forecast.daysLeft !== null && (
                        <Badge tone={forecast.needsRefill ? "amber" : "ink"}>
                          <Icon name="box" className="size-3.5" />
                          {forecast.needsRefill ? `Refill · ${pluralise(forecast.daysLeft, "day")} left` : `${pluralise(forecast.daysLeft, "day")} of supply`}
                        </Badge>
                      )}
                      {m.endDate && <Badge tone="marigold">Until {m.endDate}</Badge>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section id="safety" aria-labelledby="safety-title" className="mt-12 scroll-mt-24">
        <h2 id="safety-title" className="flex items-center gap-3 text-3xl">
          <Icon name="shield" className="size-7 text-sky-600" /> Senior safety check
        </h2>
        <p className="mt-1 mb-4 text-ink-2">Interactions, allergy conflicts, duplicates, timing and over-65 cautions across the whole list — updated whenever a medicine changes.</p>
        <SafetyList findings={findings} />
      </section>

      {stopped.length > 0 && (
        <section aria-labelledby="stopped-title" className="mt-12">
          <h2 id="stopped-title" className="text-2xl">Stopped medicines</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {stopped.map((m) => (
              <li key={m.id}>
                <Link href={`/app/medications/${m.id}`} className="flex items-center justify-between gap-4 px-5 py-3 text-ink-2 hover:bg-paper-2">
                  <span>
                    {m.name} {m.strength}
                  </span>
                  <span className="text-sm">History kept</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

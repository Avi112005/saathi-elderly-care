import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { requireMember } from "@/lib/server/session";
import { getTodayView } from "@/lib/server/queries";
import { can } from "@/lib/domain/permissions";
import { formatClock, greetingFor, localClock } from "@/lib/domain/time";
import { formatDose, pluralise } from "@/lib/domain/format";
import { FOOD_TIMING_LABEL, type FoodTiming } from "@/lib/domain/types";
import { DoseCard, type DoseCardData } from "@/components/app/dose-card";
import { RoutineCard } from "@/components/app/routine-card";
import { formatReading, ROUTINE_KIND_LABEL } from "@/lib/domain/vitals";
import { ReadAloud } from "@/components/app/read-aloud";
import { RequestDecision } from "@/components/app/action-forms";
import { Badge, ButtonLink, Card, EmptyState, ProgressRing } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const member = await requireMember();
  const now = new Date();
  const view = await getTodayView(member.profileId, now);
  const { profile, summary } = view;
  const zone = profile.timezone;
  const isElder = member.role === "ELDER";
  const canLog = can(member, "dose:log");
  const local = DateTime.fromJSDate(now, { zone });

  const toCard = (d: (typeof view.doses)[number]): DoseCardData => ({
    medicationId: d.medicationId,
    scheduledFor: d.scheduledFor.toISOString(),
    timeLabel: formatClock(d.localTime),
    state: d.state,
    name: d.med.name,
    strength: d.med.strength,
    doseLabel: formatDose(d.med.doseQuantity, d.med.doseUnit),
    foodLabel: d.med.foodTiming === "ANY" ? "" : FOOD_TIMING_LABEL[d.med.foodTiming as FoodTiming],
    instructions: d.med.instructions,
    appearance: d.med.appearance,
    pillColor: d.med.pillColor,
    purpose: d.med.purpose,
    loggedBy: d.loggedBy,
    actedLabel: d.actedAt ? formatClock(localClock(d.actedAt, zone)) : null,
    note: d.note,
    canLog: d.scheduledFor.getTime() - now.getTime() <= 3 * 3_600_000,
    canAct: canLog,
  });

  const total = view.doses.length;
  const done = summary.taken + summary.skipped;
  const next = view.next;
  const speech = [
    `${greetingFor(now, zone)}, ${isElder ? profile.preferredName : member.name}.`,
    `Today is ${local.toFormat("cccc, d LLLL")}.`,
    total === 0
      ? "There are no medicines scheduled today."
      : `${summary.taken} of ${total} medicines have been taken${summary.missed ? `, and ${summary.missed} ${summary.missed === 1 ? "is" : "are"} overdue or missed` : ""}.`,
    view.routines.some((r) => r.status === null) ? `Still to do today: ${view.routines.filter((r) => r.status === null).map((r) => r.title).join(", ")}.` : "",
    next ? `Next: ${next.med.name} ${next.med.strength}, ${formatDose(next.med.doseQuantity, next.med.doseUnit)}, at ${formatClock(next.localTime)}${next.med.foodTiming !== "ANY" ? `, ${FOOD_TIMING_LABEL[next.med.foodTiming as FoodTiming].toLowerCase()}` : ""}.` : "",
    view.appointments[0]
      ? `Your next appointment is ${view.appointments[0].title}, ${DateTime.fromJSDate(view.appointments[0].startsAt, { zone }).toFormat("cccc 'at' h:mm a")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting + day summary */}
      <section aria-labelledby="today-title" className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="eyebrow">{local.toFormat("cccc, d LLLL")}</p>
          <h1 id="today-title" className="mt-1 text-4xl leading-[1.05] sm:text-5xl">
            {greetingFor(now, zone)}, {isElder ? profile.preferredName : member.name}.
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink-2">
            {total === 0
              ? "No medicines are scheduled today."
              : next
                ? `${isElder ? "Your" : `${profile.preferredName}'s`} next medicine is ${next.med.name} at ${formatClock(next.localTime)}.`
                : `All of today's medicines are done. ${isElder ? "Well done." : ""}`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ReadAloud text={speech} />
            <ButtonLink href="/app/card" variant="ghost" icon="printer">
              Health card
            </ButtonLink>
          </div>
        </div>
        <Card className="flex items-center gap-5 p-5">
          <ProgressRing value={summary.rate} label={summary.rate === null ? "Nothing due yet today" : `${summary.rate}% of due doses taken today`} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-ink-2">Taken</dt>
            <dd className="font-semibold text-sage-700">{summary.taken}</dd>
            <dt className="text-ink-2">Still to come</dt>
            <dd className="font-semibold">{summary.pending}</dd>
            <dt className="text-ink-2">Overdue/missed</dt>
            <dd className={`font-semibold ${summary.missed ? "text-rose-700" : ""}`}>{summary.missed}</dd>
            <dt className="text-ink-2">Done</dt>
            <dd className="font-semibold">
              {done}/{total}
            </dd>
          </dl>
        </Card>
      </section>

      {/* Things that need someone's attention */}
      {(view.requests.length > 0 || view.refills.length > 0 || view.findings.length > 0) && (
        <section aria-labelledby="attention-title" className="flex flex-col gap-3">
          <h2 id="attention-title" className="sr-only">
            Needs attention
          </h2>
          {view.requests.map((r) => (
            <Card key={r.id} className="border-marigold-200 bg-marigold-50 p-5">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-marigold-800 uppercase">
                <Icon name="heart" className="size-4" /> {isElder ? "Waiting for your OK" : `Waiting for ${profile.preferredName}'s OK`}
              </p>
              <p className="mt-1.5 font-serif text-2xl leading-snug">
                {r.requestedBy.name} suggested: {r.summary}
              </p>
              <p className="mb-3 text-sm text-ink-2">{DateTime.fromJSDate(r.createdAt).setZone(zone).toRelative()}</p>
              <RequestDecision id={r.id} canDecide={can(member, "request:decide")} />
            </Card>
          ))}
          {view.findings.slice(0, 2).map((f) => (
            <Link key={f.id} href="/app/medications#safety" className="card flex items-start gap-3 border-amber-100 p-4 hover:border-amber">
              <Icon name="shield" className={`mt-0.5 size-5 ${f.severity === "high" ? "text-rose-700" : "text-amber-700"}`} />
              <span>
                <span className="font-semibold">{f.title}</span>
                <span className="block text-sm text-ink-2">{f.medications.join(" + ")} — tap to read the safety check</span>
              </span>
            </Link>
          ))}
          {view.refills.map(({ med, forecast }) => (
            <Link key={med.id} href={`/app/medications/${med.id}`} className="card flex items-start gap-3 p-4 hover:border-sky-300">
              <Icon name="box" className="mt-0.5 size-5 text-amber-700" />
              <span>
                <span className="font-semibold">Refill {med.name} soon</span>
                <span className="block text-sm text-ink-2">
                  {pluralise(med.stockCount ?? 0, med.doseUnit)} left · about {pluralise(forecast.daysLeft ?? 0, "day")} of supply
                </span>
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* The day's doses */}
      <section aria-labelledby="doses-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 id="doses-title" className="text-3xl">
            Today&apos;s medicines
          </h2>
          {can(member, "medication:edit") && (
            <ButtonLink href="/app/medications/new" variant="secondary" size="sm" icon="plus">
              Add medicine
            </ButtonLink>
          )}
        </div>
        {view.medCount === 0 ? (
          <EmptyState
            icon="pill"
            title="No medicines yet"
            action={
              can(member, "medication:edit") ? (
                <ButtonLink href="/app/medications/new" icon="plus">
                  Add the first medicine
                </ButtonLink>
              ) : undefined
            }
          >
            Add each medicine once — Saathi works out every dose, sends reminders and keeps the history.
          </EmptyState>
        ) : total === 0 ? (
          <EmptyState icon="sun" title="A day off">
            None of the medicines are scheduled for today.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-8">
            {view.groups.map(([part, doses]) => (
              <section key={part} aria-label={part}>
                <h3 className="mb-3 flex items-center gap-3 font-hand text-2xl text-sky-600">
                  {part}
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </h3>
                <ul className="flex flex-col gap-3">
                  {doses.map((d) => (
                    <li key={`${d.medicationId}-${d.scheduledFor.toISOString()}`}>
                      <DoseCard dose={toCard(d)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      {/* Healthcare routines */}
      {view.routines.length > 0 && (
        <section aria-labelledby="routines-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="routines-title" className="text-3xl">
              Health routines
            </h2>
            <Link href="/app/routines" className="ink-underline text-sm font-semibold">
              Manage routines
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {view.routines.map((r) => (
              <li key={`${r.routineId}-${r.scheduledFor.toISOString()}`}>
                <RoutineCard
                  data={{
                    routineId: r.routineId,
                    scheduledFor: r.scheduledFor.toISOString(),
                    timeLabel: formatClock(r.localTime),
                    title: r.title,
                    kind: r.kind,
                    kindLabel: ROUTINE_KIND_LABEL[r.kind],
                    notes: r.notes,
                    status: r.status,
                    readingText: formatReading(r.kind, r.reading),
                    flag: r.flag,
                    loggedBy: r.loggedBy,
                    canLog: r.scheduledFor.getTime() - now.getTime() <= 3 * 3_600_000,
                    canAct: canLog,
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Next appointments */}
      <section aria-labelledby="visits-title">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="visits-title" className="text-3xl">
            Coming up
          </h2>
          <Link href="/app/appointments" className="ink-underline text-sm font-semibold">
            All appointments
          </Link>
        </div>
        {view.appointments.length === 0 ? (
          <Card className="p-5 text-ink-2">No upcoming appointments.</Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {view.appointments.map((a) => {
              const when = DateTime.fromJSDate(a.startsAt, { zone });
              const questions = a.questions.split("\n").filter(Boolean).length;
              return (
                <li key={a.id}>
                  <Link href={`/app/appointments/${a.id}`} className="card flex gap-4 p-4 hover:border-sky-300">
                    <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-sky-50 py-2 text-sky-800">
                      <span className="text-xs font-bold uppercase">{when.toFormat("LLL")}</span>
                      <span className="font-serif text-3xl leading-none">{when.toFormat("d")}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{a.title}</span>
                      <span className="block text-sm text-ink-2">
                        {when.toFormat("ccc, h:mm a")} · {a.doctorName || a.specialty}
                      </span>
                      {questions > 0 && (
                        <Badge tone="sky" className="mt-2">
                          {pluralise(questions, "question")} for the doctor
                        </Badge>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

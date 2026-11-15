import type { Metadata } from "next";
import { DateTime } from "luxon";
import { requireMember } from "@/lib/server/session";
import { getAdherenceView, getVitalsView } from "@/lib/server/queries";
import { formatReading, ROUTINE_KIND_LABEL } from "@/lib/domain/vitals";
import { pluralise } from "@/lib/domain/format";
import type { AdherenceSummary } from "@/lib/domain/adherence";
import { Card, PageHeader, ProgressRing } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Insights" };

const PERIODS = [7, 30, 90] as const;

/** Light fills so the day number (in full ink) keeps at least 4.5:1 contrast on every cell. */
const HEAT = {
  full: "#8cc4a2",
  most: "#cfe6d7",
  some: "var(--color-marigold-200)",
  low: "#f1b7b7",
  none: "var(--color-paper-3)",
} as const;

function cellColor(s: AdherenceSummary): string {
  if (s.due === 0) return HEAT.none;
  const r = s.rate ?? 0;
  if (r === 100) return HEAT.full;
  if (r >= 75) return HEAT.most;
  if (r >= 50) return HEAT.some;
  return HEAT.low;
}

function Bar({ label, summary }: { label: string; summary: AdherenceSummary }) {
  const rate = summary.rate ?? 0;
  const tone = rate >= 90 ? "bg-sage" : rate >= 75 ? "bg-marigold-400" : "bg-rose";
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3">
      <span className="truncate text-sm font-semibold" title={label}>
        {label}
      </span>
      <span className="h-3 overflow-hidden rounded-full bg-paper-3" aria-hidden="true">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${rate}%` }} />
      </span>
      <span className="text-right text-sm tabular-nums">
        {rate}%
        <span className="sr-only">
          {" "}
          — {summary.taken} of {summary.due} doses taken
        </span>
      </span>
    </li>
  );
}

const INSIGHT_ICON: Record<string, { icon: IconName; cls: string }> = {
  good: { icon: "sparkles", cls: "bg-sage-100 text-sage-700" },
  watch: { icon: "trend", cls: "bg-amber-100 text-amber-700" },
  act: { icon: "alert", cls: "bg-rose-100 text-rose-700" },
};

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const member = await requireMember();
  const requested = Number((await searchParams).days);
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30;
  const [view, vitals] = await Promise.all([
    getAdherenceView(member.profileId, days),
    getVitalsView(member.profileId, days),
  ]);
  const zone = view.profile.timezone;
  const name = member.role === "ELDER" ? "You" : view.profile.preferredName;

  // Calendar grid aligned to weeks (Mon–Sun).
  const first = DateTime.fromJSDate(view.start, { zone }).startOf("day");
  const leading = first.weekday - 1;
  const byDate = new Map(view.daily.map((d) => [d.date, d.summary]));

  return (
    <>
      <PageHeader
        eyebrow="Adherence"
        title="Insights"
        description={`How the last ${days} days went — and the patterns worth talking about.`}
        actions={
          <nav aria-label="Period" className="flex rounded-xl border border-line bg-surface p-0.5">
            {PERIODS.map((p) => (
              <a
                key={p}
                href={`?days=${p}`}
                aria-current={p === days ? "page" : undefined}
                className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold ${p === days ? "bg-ink text-white" : "text-ink-2 hover:bg-paper-2"}`}
              >
                {p} days
              </a>
            ))}
          </nav>
        }
      />

      <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr_1fr]">
        <Card className="flex items-center justify-center p-5">
          <ProgressRing
            value={view.summary.rate}
            size={120}
            stroke={11}
            label={`${view.summary.rate ?? 0}% of doses taken in the last ${days} days`}
          />
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-2">Doses taken</p>
          <p className="font-serif text-5xl">{view.summary.taken}</p>
          <p className="text-sm text-ink-2">of {view.summary.due} due</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-2">Missed or skipped</p>
          <p className="font-serif text-5xl text-rose-700">{view.summary.missed + view.summary.skipped}</p>
          <p className="text-sm text-ink-2">{view.summary.skipped} skipped with a reason</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-2">Perfect-day streak</p>
          <p className="font-serif text-5xl text-sage-700">{view.streak}</p>
          <p className="text-sm text-ink-2">{view.streak === 1 ? "day" : "days"} with every dose taken</p>
        </Card>
      </div>

      <section aria-labelledby="insights-title" className="mt-10">
        <h2 id="insights-title" className="mb-4 text-3xl">
          What Saathi noticed
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {view.insights.map((i) => {
            const style = INSIGHT_ICON[i.tone]!;
            return (
              <li key={i.title} className="card flex gap-4 p-5">
                <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${style.cls}`}>
                  <Icon name={style.icon} />
                </span>
                <span>
                  <span className="block text-lg font-semibold">{i.title}</span>
                  <span className="block text-ink-2">{i.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="calendar-title" className="mt-10">
        <h2 id="calendar-title" className="mb-1 text-3xl">
          Day by day
        </h2>
        <p className="mb-4 text-sm text-ink-2">Each square is one day. Greener means more doses taken.</p>
        <Card className="p-5">
          <div
            className="grid max-w-xl grid-cols-7 gap-1.5"
            role="img"
            aria-label={`Calendar of daily adherence for the last ${days} days. A table version follows.`}
          >
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className="text-center text-xs font-semibold text-ink-3" aria-hidden="true">
                {d}
              </span>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <span key={`pad-${i}`} aria-hidden="true" />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = first.plus({ days: i });
              const iso = date.toISODate()!;
              const s = byDate.get(iso) ?? { taken: 0, skipped: 0, missed: 0, pending: 0, due: 0, rate: null };
              return (
                <span
                  key={iso}
                  aria-hidden="true"
                  title={`${date.toFormat("ccc d LLL")}: ${s.due ? `${s.taken}/${s.due} taken` : "nothing due"}`}
                  className="grid aspect-square place-items-center rounded-md text-xs font-semibold text-ink"
                  style={{ background: cellColor(s) }}
                >
                  {date.day}
                </span>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-2" aria-hidden="true">
            {[
              [HEAT.full, "All taken"],
              [HEAT.most, "75%+"],
              [HEAT.some, "50–74%"],
              [HEAT.low, "Under 50%"],
              [HEAT.none, "Nothing due"],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-line-2" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
          <table className="sr-only">
            <caption>Daily adherence</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Taken</th>
                <th scope="col">Due</th>
              </tr>
            </thead>
            <tbody>
              {view.daily.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.summary.taken}</td>
                  <td>{d.summary.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="by-med-title">
          <h2 id="by-med-title" className="mb-4 text-2xl">
            By medicine
          </h2>
          <Card className="p-5">
            {view.perMed.length === 0 ? (
              <p className="text-ink-2">No doses due yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {view.perMed.map((m) => (
                  <Bar key={m.id} label={`${m.name}${m.active ? "" : " (stopped)"}`} summary={m.summary} />
                ))}
              </ul>
            )}
          </Card>
        </section>
        <section aria-labelledby="by-time-title">
          <h2 id="by-time-title" className="mb-4 text-2xl">
            By time of day
          </h2>
          <Card className="p-5">
            {view.perPart.length === 0 ? (
              <p className="text-ink-2">No doses due yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {view.perPart.map((p) => (
                  <Bar key={p.part} label={p.part} summary={p.summary} />
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
      {vitals.length > 0 && (
        <section id="vitals" aria-labelledby="vitals-title" className="mt-10 scroll-mt-24">
          <h2 id="vitals-title" className="mb-1 text-3xl">
            Health readings
          </h2>
          <p className="mb-4 text-sm text-ink-2">
            From the measurement routines over the last {days} days. Flags use general adult ranges — the doctor&apos;s
            own targets come first.
          </p>
          <div
            className="card overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Health readings table (scrolls sideways)"
          >
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Health readings summary</caption>
              <thead className="border-b border-line bg-paper-2 text-ink-2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Check
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Latest
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Average
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Readings
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Out of range
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {vitals.map((v) => (
                  <tr key={v.routineId}>
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {v.title}
                      <span className="block font-normal text-ink-2">{ROUTINE_KIND_LABEL[v.kind]}</span>
                    </th>
                    <td className="px-4 py-3">
                      {v.summary.latest ? formatReading(v.kind, v.summary.latest) : "—"}
                      {v.summary.latest && v.summary.latest.flag !== "NORMAL" && (
                        <span className="ml-2 font-semibold text-rose-700">
                          ({v.summary.latest.flag.toLowerCase()})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{v.summary.average ? formatReading(v.kind, v.summary.average) : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{v.summary.count}</td>
                    <td className={`px-4 py-3 tabular-nums ${v.summary.flagged ? "font-semibold text-amber-700" : ""}`}>
                      {v.summary.flagged}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="mt-6 text-sm text-ink-2">
        {name === "You" ? "Your" : `${name}'s`} adherence covers {pluralise(view.summary.due, "due dose")}. Doses still
        to come today aren&apos;t counted.
      </p>
    </>
  );
}

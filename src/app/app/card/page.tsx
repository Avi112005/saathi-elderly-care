import type { Metadata } from "next";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { getAdherenceView, getVitalsView, safetyFindings } from "@/lib/server/queries";
import { describeDays, parseTimes } from "@/lib/domain/schedule";
import { ageFrom, formatClock } from "@/lib/domain/time";
import { formatDose } from "@/lib/domain/format";
import { FOOD_TIMING_LABEL, type FoodTiming } from "@/lib/domain/types";
import { formatReading } from "@/lib/domain/vitals";
import { PrintButton } from "@/components/app/print-button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { LogoMark } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Health card" };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-line py-2 last:border-0">
      <dt className="text-sm font-semibold text-ink-2">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

export default async function HealthCardPage() {
  const member = await requireMember();
  const profile = await prisma.careProfile.findUniqueOrThrow({ where: { id: member.profileId } });
  const [next, adherence, vitals] = await Promise.all([
    prisma.appointment.findFirst({ where: { profileId: member.profileId, status: "SCHEDULED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }),
    getAdherenceView(member.profileId, 30, new Date(), profile),
    getVitalsView(member.profileId, 30),
  ]);
  const meds = [...adherence.activeMeds].sort((a, b) => a.name.localeCompare(b.name));
  const findings = safetyFindings(profile, meds);
  const zone = profile.timezone;
  const age = ageFrom(profile.dateOfBirth);
  const important = findings.filter((f) => f.severity !== "info");

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="For clinics, pharmacies & emergencies"
          title="Health card"
          description="A one-page summary to print, keep in a wallet or show the doctor. It reflects the latest medicines."
          actions={<PrintButton />}
        />
      </div>

      <Card className="mx-auto max-w-3xl p-6 sm:p-10">
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-5">
          <div>
            <p className="text-xs font-semibold tracking-widest text-ink-2 uppercase">Medical summary</p>
            <h2 className="mt-1 text-4xl leading-tight">{profile.fullName}</h2>
            <p className="text-ink-2">
              {[age !== null ? `${age} years` : null, profile.dateOfBirth ? `born ${DateTime.fromJSDate(profile.dateOfBirth, { zone: "utc" }).toFormat("d LLL yyyy")}` : null, profile.bloodGroup ? `blood group ${profile.bloodGroup}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <LogoMark className="size-12" />
        </header>

        <div className="mt-6 rounded-xl border-2 border-rose bg-rose-100/50 p-4">
          <p className="text-xs font-bold tracking-widest text-rose-700 uppercase">Allergies</p>
          <p className="mt-1 text-xl font-semibold">{profile.allergies || "None known"}</p>
        </div>

        <dl className="mt-6">
          <Row label="Conditions" value={profile.conditions} />
          <Row label="Emergency contact" value={profile.emergencyContact} />
          <Row label="Primary doctor" value={profile.primaryDoctor} />
          <Row label="Notes" value={profile.notes} />
        </dl>

        <h3 className="mt-8 text-2xl">Current medicines</h3>
        <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Current medicines table (scrolls sideways)">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Current medicines with dose and schedule</caption>
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className="py-2 pr-3">Medicine</th>
                <th scope="col" className="py-2 pr-3">Dose</th>
                <th scope="col" className="py-2 pr-3">When</th>
                <th scope="col" className="py-2">For</th>
              </tr>
            </thead>
            <tbody>
              {meds.map((m) => (
                <tr key={m.id} className="border-b border-line align-top">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {m.name} {m.strength}
                  </th>
                  <td className="py-2 pr-3">
                    {formatDose(m.doseQuantity, m.doseUnit)}
                    {m.foodTiming !== "ANY" && <span className="block text-ink-2">{FOOD_TIMING_LABEL[m.foodTiming as FoodTiming]}</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {parseTimes(m.times).map(formatClock).join(", ")}
                    <span className="block text-ink-2">{describeDays(m.daysOfWeek)}</span>
                  </td>
                  <td className="py-2">{m.purpose || "—"}</td>
                </tr>
              ))}
              {meds.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-ink-2">No current medicines.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <section>
            <h3 className="text-xl">Last 30 days</h3>
            <p className="mt-1">
              <strong className="font-serif text-3xl">{adherence.summary.rate ?? "—"}%</strong> of doses taken ({adherence.summary.taken} of {adherence.summary.due}).
            </p>
            {adherence.perMed.filter((m) => (m.summary.rate ?? 100) < 85).length > 0 && (
              <p className="mt-1 text-sm text-ink-2">
                Often missed: {adherence.perMed.filter((m) => (m.summary.rate ?? 100) < 85).map((m) => `${m.name} (${m.summary.rate}%)`).join(", ")}
              </p>
            )}
          </section>
          {next && (
            <section>
              <h3 className="text-xl">Next visit</h3>
              <p className="mt-1 font-semibold">
                {next.title} — {DateTime.fromJSDate(next.startsAt, { zone }).toFormat("d LLL, h:mm a")}
              </p>
              {next.questions && (
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {next.questions.split("\n").filter(Boolean).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {vitals.some((v) => v.summary.count > 0) && (
          <section className="mt-8">
            <h3 className="text-xl">Home readings (last 30 days)</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {vitals
                .filter((v) => v.summary.count > 0)
                .map((v) => (
                  <li key={v.routineId}>
                    <strong>{v.title}</strong>: latest {formatReading(v.kind, v.summary.latest!)}, average {formatReading(v.kind, v.summary.average!)} — {v.summary.count} readings
                    {v.summary.flagged ? `, ${v.summary.flagged} out of range` : ""}
                  </li>
                ))}
            </ul>
          </section>
        )}

        {important.length > 0 && (
          <section className="mt-8">
            <h3 className="text-xl">To discuss with the doctor or pharmacist</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {important.map((f) => (
                <li key={f.id}>
                  <strong>{f.medications.join(" + ")}</strong>: {f.title}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 border-t border-line pt-4 text-xs text-ink-2">
          Generated by Saathi on {DateTime.now().setZone(zone).toFormat("d LLL yyyy, h:mm a")}. Care code {profile.careCode}. Information is entered by the family and is not verified by a clinician.
        </p>
      </Card>
    </>
  );
}

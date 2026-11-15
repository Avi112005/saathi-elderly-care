import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { safetyFindings } from "@/lib/server/queries";
import { can, requiresConsent } from "@/lib/domain/permissions";
import { findingsFor } from "@/lib/domain/safety";
import { forecastRefill, parseDays, parseTimes } from "@/lib/domain/schedule";
import { formatClock, localClock } from "@/lib/domain/time";
import { pluralise } from "@/lib/domain/format";
import { MedicationForm } from "@/components/app/medication-form";
import { SafetyList } from "@/components/app/safety-list";
import { AddStockForm, StopMedicationButton } from "@/components/app/action-forms";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Medicine" };

const STATUS_TONE = { TAKEN: "sage", SKIPPED: "ink", MISSED: "rose" } as const;

export default async function MedicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMember();
  const med = await prisma.medication.findFirst({ where: { id, profileId: member.profileId } });
  if (!med) notFound();

  const zone = member.profile.timezone;
  const [history, profile, activeMeds, hasElder, pending] = await Promise.all([
    prisma.doseLog.findMany({ where: { medicationId: med.id }, orderBy: { scheduledFor: "desc" }, take: 20, include: { loggedBy: { select: { name: true } } } }),
    prisma.careProfile.findUniqueOrThrow({ where: { id: member.profileId }, select: { allergies: true, dateOfBirth: true } }),
    prisma.medication.findMany({ where: { profileId: member.profileId, active: true }, select: { name: true, times: true } }),
    prisma.member.count({ where: { profileId: member.profileId, role: "ELDER", active: true } }),
    prisma.changeRequest.count({ where: { medicationId: med.id, status: "PENDING" } }),
  ]);
  const editable = can(member, "medication:edit") && med.active;
  const consent = requiresConsent(member, member.profile.consentMode, hasElder > 0);
  const forecast = forecastRefill(med, zone);
  const mine = findingsFor(med.name, safetyFindings(profile, activeMeds));

  return (
    <>
      <PageHeader
        eyebrow={med.active ? "Medicine" : "Stopped medicine"}
        title={
          <>
            {med.name} <span className="text-ink-2">{med.strength}</span>
          </>
        }
        description={med.purpose ? `For ${med.purpose.toLowerCase()}` : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {pending > 0 && (
            <p role="status" className="rounded-xl border border-marigold-200 bg-marigold-50 p-4 text-sm">
              A change to this medicine is waiting for the elder&apos;s approval.
            </p>
          )}
          {mine.length > 0 && (
            <section aria-labelledby="med-safety">
              <h2 id="med-safety" className="mb-3 text-2xl">Safety notes</h2>
              <SafetyList findings={mine} />
            </section>
          )}
          {editable ? (
            <Card className="p-5 sm:p-8">
              <h2 className="mb-6 text-2xl">Edit</h2>
              <MedicationForm
                consentRequired={consent}
                initial={{
                  id: med.id,
                  name: med.name,
                  strength: med.strength,
                  form: med.form,
                  doseQuantity: med.doseQuantity,
                  doseUnit: med.doseUnit,
                  times: parseTimes(med.times),
                  daysOfWeek: parseDays(med.daysOfWeek),
                  startDate: med.startDate,
                  endDate: med.endDate ?? "",
                  foodTiming: med.foodTiming,
                  instructions: med.instructions,
                  purpose: med.purpose,
                  prescriber: med.prescriber,
                  appearance: med.appearance,
                  pillColor: med.pillColor,
                  stockCount: med.stockCount === null ? "" : String(med.stockCount),
                  refillAt: med.refillAt,
                }}
              />
            </Card>
          ) : (
            <Card className="p-5 text-ink-2">
              {med.active ? "You can view this medicine; a caretaker or the elder can change it." : "This medicine was stopped. Its dose history is kept below."}
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">Supply</h2>
            {med.stockCount === null ? (
              <p className="mt-2 text-ink-2">Stock isn&apos;t being tracked.</p>
            ) : (
              <>
                <p className="mt-2 font-serif text-4xl">{med.stockCount}</p>
                <p className="text-sm text-ink-2">
                  {med.doseUnit}s left · {forecast.daysLeft !== null ? `${pluralise(forecast.daysLeft, "day")} at ${forecast.dailyUse}/day` : ""}
                </p>
                {forecast.runsOutOn && <p className={`mt-1 text-sm font-semibold ${forecast.needsRefill ? "text-amber-700" : "text-ink"}`}>Runs out around {DateTime.fromISO(forecast.runsOutOn).toFormat("d LLL")}</p>}
              </>
            )}
            {can(member, "dose:log") && med.active && (
              <div className="mt-4 border-t border-line pt-4">
                <AddStockForm id={med.id} unit={med.doseUnit} />
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">Recent doses</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">No doses logged yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <span>
                      {DateTime.fromJSDate(h.scheduledFor, { zone }).toFormat("d LLL")} · {formatClock(localClock(h.scheduledFor, zone))}
                    </span>
                    <Badge tone={STATUS_TONE[h.status as keyof typeof STATUS_TONE] ?? "ink"}>{h.status.toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {editable && (
            <Card className="p-5">
              <h2 className="mb-3 font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">Stop</h2>
              <p className="mb-3 text-sm text-ink-2">Stops future reminders. History is kept for the doctor.</p>
              <StopMedicationButton id={med.id} consent={consent} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

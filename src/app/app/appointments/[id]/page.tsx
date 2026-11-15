import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { AppointmentForm, OutcomeForm, QuestionForm } from "@/components/app/appointment-forms";
import { Card, PageHeader, buttonClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Appointment" };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMember();
  const appt = await prisma.appointment.findFirst({ where: { id, profileId: member.profileId } });
  if (!appt) notFound();
  const zone = member.profile.timezone;
  const when = DateTime.fromJSDate(appt.startsAt, { zone });
  const questions = appt.questions.split("\n").map((q) => q.trim()).filter(Boolean);
  const editable = can(member, "appointment:edit");

  return (
    <>
      <PageHeader
        eyebrow={when.toFormat("cccc d LLLL yyyy · h:mm a")}
        title={appt.title}
        description={[appt.doctorName, appt.specialty, appt.location].filter(Boolean).join(" · ")}
        actions={
          <a href={`/api/appointments/${appt.id}/ics`} className={buttonClass("secondary")} download>
            <Icon name="download" className="size-4" /> Add to calendar
          </a>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-2xl"><Icon name="help" className="size-6 text-sky-600" /> Questions for the doctor</h2>
            <p className="mt-1 text-sm text-ink-2">Take this list into the room — or print the health card, which includes it.</p>
            {questions.length === 0 ? (
              <p className="mt-4 text-ink-2">No questions yet.</p>
            ) : (
              <ol className="mt-4 flex list-decimal flex-col gap-2 pl-6 marker:font-serif marker:text-sky-600">
                {questions.map((q, i) => (
                  <li key={i} className="pl-1 text-lg">{q}</li>
                ))}
              </ol>
            )}
            {appt.status === "SCHEDULED" && (
              <div className="mt-5 border-t border-line pt-5">
                <QuestionForm id={appt.id} />
              </div>
            )}
          </Card>

          {editable && (
            <details className="card group p-5 sm:p-6">
              <summary className="flex cursor-pointer items-center justify-between font-serif text-2xl">
                Edit details
                <Icon name="edit" className="size-5 text-ink-2" />
              </summary>
              <div className="mt-6">
                <AppointmentForm
                  initial={{
                    id: appt.id,
                    title: appt.title,
                    doctorName: appt.doctorName,
                    specialty: appt.specialty,
                    location: appt.location,
                    date: when.toISODate() ?? "",
                    time: when.toFormat("HH:mm"),
                    durationMin: appt.durationMin,
                    notes: appt.notes,
                    questions: appt.questions,
                    transport: appt.transport,
                  }}
                />
              </div>
            </details>
          )}
        </div>
        <aside className="flex flex-col gap-4">
          {(appt.transport || appt.notes) && (
            <Card className="p-5">
              {appt.transport && (
                <>
                  <h2 className="font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">Getting there</h2>
                  <p className="mt-1">{appt.transport}</p>
                </>
              )}
              {appt.notes && (
                <>
                  <h2 className="mt-4 font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">Bring / notes</h2>
                  <p className="mt-1 whitespace-pre-line">{appt.notes}</p>
                </>
              )}
            </Card>
          )}
          <Card className="p-5">
            <h2 className="mb-4 font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">After the visit</h2>
            {editable ? <OutcomeForm id={appt.id} status={appt.status} outcome={appt.outcome} /> : <p className="whitespace-pre-line">{appt.outcome || "No notes yet."}</p>}
          </Card>
        </aside>
      </div>
    </>
  );
}

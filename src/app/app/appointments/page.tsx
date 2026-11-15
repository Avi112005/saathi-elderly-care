import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { pluralise } from "@/lib/domain/format";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Appointments" };

const STATUS = { SCHEDULED: { tone: "sky", label: "Upcoming" }, COMPLETED: { tone: "sage", label: "Completed" }, CANCELLED: { tone: "ink", label: "Cancelled" } } as const;

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const member = await requireMember();
  const { saved } = await searchParams;
  const zone = member.profile.timezone;
  const now = new Date();
  const all = await prisma.appointment.findMany({ where: { profileId: member.profileId }, orderBy: { startsAt: "asc" } });
  const upcoming = all.filter((a) => a.status === "SCHEDULED" && a.startsAt.getTime() >= now.getTime() - 3_600_000);
  const past = all.filter((a) => !upcoming.includes(a)).reverse();

  const row = (a: (typeof all)[number]) => {
    const when = DateTime.fromJSDate(a.startsAt, { zone });
    const qs = a.questions.split("\n").filter(Boolean).length;
    const s = STATUS[a.status as keyof typeof STATUS] ?? STATUS.SCHEDULED;
    return (
      <li key={a.id}>
        <Link href={`/app/appointments/${a.id}`} className="card flex gap-4 p-4 transition-colors hover:border-sky-300 sm:p-5">
          <span className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-sky-50 py-2 text-sky-800">
            <span className="text-xs font-bold uppercase">{when.toFormat("LLL")}</span>
            <span className="font-serif text-3xl leading-none">{when.toFormat("d")}</span>
            <span className="text-xs">{when.toFormat("ccc")}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{a.title}</span>
              <Badge tone={s.tone}>{s.label}</Badge>
            </span>
            <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              <span className="flex items-center gap-1"><Icon name="clock" className="size-4" /> {when.toFormat("h:mm a")}</span>
              {a.doctorName && <span className="flex items-center gap-1"><Icon name="user" className="size-4" /> {a.doctorName}</span>}
              {a.location && <span className="flex items-center gap-1"><Icon name="pin" className="size-4" /> {a.location}</span>}
            </span>
            {qs > 0 && a.status === "SCHEDULED" && <span className="mt-2 block text-sm text-sky-700">{pluralise(qs, "question")} ready for the doctor</span>}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Doctor visits"
        title="Appointments"
        description="Everyone in the circle gets an email the day before and two hours before each visit."
        actions={can(member, "appointment:edit") ? <ButtonLink href="/app/appointments/new" icon="plus">Add appointment</ButtonLink> : undefined}
      />
      {saved && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-sage-100 bg-sage-100/70 px-4 py-3 text-sage-700">
          <Icon name="check" className="size-5" /> Saved. Reminders are scheduled.
        </p>
      )}
      <section aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="mb-3 text-2xl">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon="calendar" title="Nothing booked" action={<ButtonLink href="/app/appointments/new" icon="plus">Add an appointment</ButtonLink>}>
            Add the next doctor visit and Saathi will remind everyone.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">{upcoming.map(row)}</ul>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past-title" className="mt-10">
          <h2 id="past-title" className="mb-3 text-2xl">Past &amp; cancelled</h2>
          <ul className="flex flex-col gap-3">{past.map(row)}</ul>
        </section>
      )}
    </>
  );
}

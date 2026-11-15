import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { requireMember } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { AppointmentForm } from "@/components/app/appointment-forms";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Add appointment" };

export default async function NewAppointmentPage() {
  const member = await requireMember();
  if (!can(member, "appointment:edit")) redirect("/app/appointments");
  const tomorrow = DateTime.now().setZone(member.profile.timezone).plus({ days: 1 });
  return (
    <>
      <PageHeader eyebrow="Appointments" title="Add an appointment" />
      <div className="card p-5 sm:p-8">
        <AppointmentForm
          initial={{
            title: "",
            doctorName: "",
            specialty: "",
            location: "",
            date: tomorrow.toISODate() ?? "",
            time: "10:00",
            durationMin: 30,
            notes: "",
            questions: "",
            transport: "",
          }}
        />
      </div>
    </>
  );
}

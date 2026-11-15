import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { can, requiresConsent } from "@/lib/domain/permissions";
import { MedicationForm } from "@/components/app/medication-form";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Add medicine" };

export default async function NewMedicationPage() {
  const member = await requireMember();
  if (!can(member, "medication:edit")) redirect("/app/medications");
  const hasElder = (await prisma.member.count({ where: { profileId: member.profileId, role: "ELDER", active: true } })) > 0;

  return (
    <>
      <PageHeader eyebrow="Medicines" title="Add a medicine" description="Fill it in once from the prescription or the strip. Saathi works out every dose from here." />
      <div className="card p-5 sm:p-8">
        <MedicationForm
          consentRequired={requiresConsent(member, member.profile.consentMode, hasElder)}
          initial={{
            name: "",
            strength: "",
            form: "TABLET",
            doseQuantity: 1,
            doseUnit: "tablet",
            times: ["08:00"],
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            startDate: DateTime.now().setZone(member.profile.timezone).toISODate() ?? "",
            endDate: "",
            foodTiming: "ANY",
            instructions: "",
            purpose: "",
            prescriber: "",
            appearance: "",
            pillColor: "white",
            stockCount: "",
            refillAt: 7,
          }}
        />
      </div>
    </>
  );
}

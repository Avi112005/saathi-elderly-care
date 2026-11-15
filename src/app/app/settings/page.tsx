import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { ChangePinForm, DeleteCircleForm, MySettingsForm, ProfileForm } from "@/components/app/settings-forms";
import { Card, PageHeader } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Settings" };

const MORE: { href: string; label: string; icon: IconName }[] = [
  { href: "/app/routines", label: "Routines", icon: "heartPulse" },
  { href: "/app/insights", label: "Insights", icon: "chart" },
  { href: "/app/card", label: "Health card", icon: "file" },
  { href: "/app/activity", label: "Activity", icon: "activity" },
  { href: "/app/outbox", label: "Email outbox", icon: "mail" },
];

export default async function SettingsPage() {
  const member = await requireMember();
  const [me, profile] = await Promise.all([
    prisma.member.findUniqueOrThrow({ where: { id: member.id } }),
    prisma.careProfile.findUniqueOrThrow({ where: { id: member.profileId } }),
  ]);
  const editProfile = can(member, "profile:edit");

  return (
    <>
      <nav aria-label="More pages" className="mb-8 grid grid-cols-2 gap-2 lg:hidden">
        {MORE.map((m) => (
          <Link key={m.href} href={m.href} className="card flex min-h-14 items-center gap-3 px-4 font-semibold">
            <Icon name={m.icon} className="text-sky-600" /> {m.label}
          </Link>
        ))}
      </nav>
      <PageHeader eyebrow="Settings" title="Your settings" description="Your details and emails are personal. Health details are shared with the whole circle." />

      <div className="flex flex-col gap-8">
        <section aria-labelledby="me-title">
          <h2 id="me-title" className="mb-3 text-2xl">Me &amp; notifications</h2>
          <Card className="p-5 sm:p-6">
            <MySettingsForm
              initial={{
                name: me.name,
                relationship: me.relationship,
                email: me.email ?? "",
                emailDoseReminders: me.emailDoseReminders,
                emailMissedDoses: me.emailMissedDoses,
                emailAppointments: me.emailAppointments,
                emailRefills: me.emailRefills,
                emailDailyDigest: me.emailDailyDigest,
                emailVitalAlerts: me.emailVitalAlerts,
                quietStart: me.quietStart ?? "",
                quietEnd: me.quietEnd ?? "",
              }}
            />
          </Card>
        </section>

        <section aria-labelledby="pin-title">
          <h2 id="pin-title" className="mb-3 text-2xl">PIN</h2>
          <Card className="p-5 sm:p-6">
            <ChangePinForm />
          </Card>
        </section>

        {editProfile && (
          <section aria-labelledby="profile-title">
            <h2 id="profile-title" className="mb-3 text-2xl">{profile.preferredName}&apos;s health profile</h2>
            <Card className="p-5 sm:p-6">
              <ProfileForm
                zones={Intl.supportedValuesOf("timeZone")}
                initial={{
                  fullName: profile.fullName,
                  preferredName: profile.preferredName,
                  dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : "",
                  timezone: profile.timezone,
                  conditions: profile.conditions,
                  allergies: profile.allergies,
                  bloodGroup: profile.bloodGroup ?? "",
                  emergencyContact: profile.emergencyContact ?? "",
                  primaryDoctor: profile.primaryDoctor ?? "",
                  notes: profile.notes,
                  reminderLeadMin: profile.reminderLeadMin,
                  nudgeAfterMin: profile.nudgeAfterMin,
                  escalateAfterMin: profile.escalateAfterMin,
                }}
              />
            </Card>
          </section>
        )}

        {editProfile && !profile.isDemo && (
          <section aria-labelledby="danger-title">
            <h2 id="danger-title" className="mb-3 text-2xl text-rose-700">Delete care circle</h2>
            <Card className="border-rose-100 p-5 sm:p-6">
              <p className="mb-4 text-ink-2">Removes the profile, medicines, history, appointments and every member&apos;s access. This cannot be undone.</p>
              <DeleteCircleForm name={profile.preferredName} />
            </Card>
          </section>
        )}
      </div>
    </>
  );
}

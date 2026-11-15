import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { getCurrentMember } from "@/lib/server/session";
import { careCodeSchema } from "@/lib/validation/schemas";
import { ROLE_LABEL, ROLE_ORDER, isRole } from "@/lib/domain/types";
import { AuthShell } from "@/components/auth/auth-shell";
import { PinSignIn } from "@/components/auth/pin-sign-in";

export const metadata: Metadata = { title: "Who's checking in?", robots: { index: false } };

export default async function ChooseMemberPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ next?: string }> }) {
  const parsed = careCodeSchema.safeParse(decodeURIComponent((await params).code));
  if (!parsed.success) notFound();
  const { next } = await searchParams;

  const current = await getCurrentMember();
  if (current?.profile.careCode === parsed.data) redirect("/app");

  const profile = await prisma.careProfile.findUnique({
    where: { careCode: parsed.data },
    select: {
      preferredName: true,
      careCode: true,
      // Only first names, roles and colours are shown before sign-in — never emails.
      members: { where: { active: true }, select: { id: true, name: true, role: true, avatarColor: true, relationship: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!profile) notFound();

  const members = profile.members
    .filter((m) => isRole(m.role))
    .sort((a, b) => ROLE_ORDER[a.role as keyof typeof ROLE_ORDER] - ROLE_ORDER[b.role as keyof typeof ROLE_ORDER])
    .map((m) => ({
      id: m.id,
      name: m.name.split(" ")[0] ?? m.name,
      roleLabel: m.role === "ELDER" ? "Elder" : m.relationship || ROLE_LABEL[m.role as keyof typeof ROLE_LABEL],
      avatarColor: m.avatarColor,
    }));

  return (
    <AuthShell
      eyebrow={`Care circle · ${profile.careCode}`}
      title={<>{profile.preferredName}&apos;s circle</>}
      description="Tap your name, then enter your personal PIN."
      footer={<Link href="/access" className="ink-underline">Use a different care code</Link>}
    >
      <PinSignIn careCode={profile.careCode} members={members} next={next} />
    </AuthShell>
  );
}

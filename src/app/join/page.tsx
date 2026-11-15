import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { JoinForm } from "@/components/auth/join-form";

export const metadata: Metadata = { title: "Join a care circle" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <AuthShell
      eyebrow="You've been invited"
      title="Join a care circle"
      description="Enter the invite code you were sent, then choose your own PIN."
      footer={
        <>
          Already a member?{" "}
          <Link href="/access" className="ink-underline font-semibold text-ink">
            Sign in
          </Link>
        </>
      }
    >
      <JoinForm code={typeof code === "string" ? code.slice(0, 24) : undefined} />
    </AuthShell>
  );
}

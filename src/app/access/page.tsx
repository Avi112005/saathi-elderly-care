import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { CareCodeForm } from "@/components/auth/care-code-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Open a care circle"
      description="Enter the circle's care code. Next, you'll choose who you are and type your own PIN."
      footer={
        <>
          New here?{" "}
          <Link className="ink-underline font-semibold text-ink" href="/start">
            Create a care circle
          </Link>{" "}
          · Got an invite?{" "}
          <Link className="ink-underline font-semibold text-ink" href="/join">
            Join with it
          </Link>
        </>
      }
    >
      <CareCodeForm next={next} />
    </AuthShell>
  );
}

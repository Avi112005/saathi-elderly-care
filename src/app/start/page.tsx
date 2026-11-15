import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { StartForm } from "@/components/auth/start-form";

export const metadata: Metadata = { title: "Create a care circle" };

export default function StartPage() {
  const zones = Intl.supportedValuesOf("timeZone");
  return (
    <AuthShell
      wide
      eyebrow="Two minutes to set up"
      title="Create a care circle"
      description="One shared, private home for an elder's medicines, appointments and the people who help."
      footer={
        <>
          Already have one?{" "}
          <Link href="/access" className="ink-underline font-semibold text-ink">
            Sign in
          </Link>
        </>
      }
    >
      <StartForm zones={zones} />
    </AuthShell>
  );
}

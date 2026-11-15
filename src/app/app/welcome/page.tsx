import type { Metadata } from "next";
import { requireMember } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const member = await requireMember();
  const steps: { icon: IconName; title: string; body: string; href: string; cta: string }[] = [
    { icon: "pill", title: "Add the medicines", body: "From the prescription or the strips. Saathi works out every dose.", href: "/app/medications/new", cta: "Add a medicine" },
    { icon: "users", title: "Invite the circle", body: "A caretaker, a sibling, a neighbour — each gets their own PIN.", href: "/app/circle", cta: "Create an invite" },
    { icon: "calendar", title: "Add the next doctor visit", body: "Everyone is reminded the day before and two hours before.", href: "/app/appointments/new", cta: "Add appointment" },
    { icon: "mail", title: "Check emails arrive", body: "Send yourself a test and see the outbox.", href: "/app/outbox", cta: "Open outbox" },
  ];
  return (
    <div className="flex flex-col gap-8">
      <Card className="paper-ruled p-6 sm:p-10">
        <p className="eyebrow">Your care circle is ready</p>
        <h1 className="mt-1 text-5xl leading-tight">Welcome, {member.name}.</h1>
        <p className="mt-4 max-w-xl text-lg text-ink-2">Everyone signs in with this care code plus their own PIN. Write it down somewhere safe — on the fridge is fine; it&apos;s useless without a PIN.</p>
        <p className="mt-6 inline-block rounded-2xl border-2 border-dashed border-sky-300 bg-surface px-6 py-4 font-mono text-4xl tracking-[0.2em] select-all">{member.profile.careCode}</p>
      </Card>
      <ol className="grid gap-4 md:grid-cols-2">
        {steps
          .filter((s) => s.href !== "/app/medications/new" || can(member, "medication:edit"))
          .map((s, i) => (
            <li key={s.title} className="card flex flex-col gap-3 p-5">
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700"><Icon name={s.icon} /></span>
                <span className="font-serif text-4xl text-paper-3 before:content-[attr(data-n)]" data-n={`0${i + 1}`} aria-hidden="true" />
              </span>
              <h2 className="text-2xl">{s.title}</h2>
              <p className="text-ink-2">{s.body}</p>
              <div className="mt-auto pt-2">
                <ButtonLink href={s.href} variant="secondary" icon="arrowRight">{s.cta}</ButtonLink>
              </div>
            </li>
          ))}
      </ol>
      <div>
        <ButtonLink href="/app" size="lg">Go to Today</ButtonLink>
      </div>
    </div>
  );
}

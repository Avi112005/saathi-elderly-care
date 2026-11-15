import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { A11Y_COOKIE, parseA11y } from "@/lib/a11y";
import { ROLE_LABEL } from "@/lib/domain/types";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/primitives";
import { DisplayControls } from "@/components/app/display-controls";
import { SideNavLink, TabLink, type NavItem } from "@/components/app/nav-link";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const [pending, avatar, prefsCookie] = await Promise.all([
    prisma.changeRequest.count({ where: { profileId: member.profileId, status: "PENDING" } }),
    prisma.member.findUnique({ where: { id: member.id }, select: { avatarColor: true } }),
    cookies(),
  ]);
  const prefs = parseA11y(prefsCookie.get(A11Y_COOKIE)?.value);
  const elder = member.profile.preferredName;

  const nav: NavItem[] = [
    { href: "/app", label: "Today", icon: "home" },
    { href: "/app/medications", label: "Medicines", icon: "pill" },
    { href: "/app/routines", label: "Routines", icon: "heartPulse" },
    { href: "/app/appointments", label: "Appointments", icon: "calendar" },
    { href: "/app/insights", label: "Insights", icon: "chart" },
    { href: "/app/circle", label: "Care circle", icon: "users", badge: pending },
    { href: "/app/card", label: "Health card", icon: "file" },
    { href: "/app/activity", label: "Activity", icon: "activity" },
    { href: "/app/outbox", label: "Email outbox", icon: "mail" },
    { href: "/app/settings", label: "Settings", icon: "sliders" },
  ];
  const tabs: NavItem[] = [
    nav[0]!,
    nav[1]!,
    nav[3]!,
    { ...nav[5]!, label: "Circle" },
    { href: "/app/settings", label: "More", icon: "menu" },
  ];

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[17rem_1fr]">
      <aside
        className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/70 px-4 py-5 lg:flex"
        aria-label="Sidebar"
      >
        <Logo href="/app" />
        <div className="mt-6 rounded-2xl border border-line bg-paper p-3.5">
          <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Caring for</p>
          <p className="mt-0.5 font-serif text-2xl leading-tight">{member.profile.fullName}</p>
          <p className="mt-1 font-mono text-xs text-ink-2">Code · {member.profile.careCode}</p>
        </div>
        <nav aria-label="App" className="mt-5 flex-1 overflow-y-auto">
          <ul className="flex flex-col gap-0.5">
            {nav.map((item) => (
              <li key={item.href}>
                <SideNavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
          <Avatar name={member.name} color={avatar?.avatarColor} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{member.name}</p>
            <p className="text-xs text-ink-2">
              {ROLE_LABEL[member.role]}
              {member.isAdmin && member.role !== "ELDER" ? " · admin" : ""}
            </p>
          </div>
          <form action={signOut}>
            <button
              className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-paper-2 hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {member.profile.isDemo && (
          <p className="no-print bg-ink px-4 py-2 text-center text-sm text-white">
            Demo circle — you&apos;re signed in as <strong>{member.name}</strong> (
            {ROLE_LABEL[member.role].toLowerCase()}). Sample data only.
          </p>
        )}
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur sm:px-8">
          <div className="lg:hidden">
            <Logo href="/app" sub={false} />
          </div>
          <p className="hidden text-sm text-ink-2 sm:block lg:block">
            {member.role === "ELDER" ? "Your care circle" : `${elder}'s care circle`}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <DisplayControls prefs={prefs} />
            <form action={signOut} className="lg:hidden">
              <button
                className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-paper-2"
                aria-label="Sign out"
              >
                <Icon name="logout" />
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-28 sm:px-8 lg:pb-16">
          {children}
        </main>
      </div>

      <nav
        aria-label="App (mobile)"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {tabs.map((t) => (
            <li key={t.href} className="flex flex-1">
              <TabLink item={t} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

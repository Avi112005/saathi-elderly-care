import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/primitives";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#families", label: "For families" },
  { href: "/#trust", label: "Under the hood" },
];

export function SiteNav() {
  return (
    <div className="sticky top-3 z-40 px-3 sm:px-6">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-2 rounded-2xl sm:gap-4 border border-line bg-surface/90 px-4 py-2.5 shadow-[var(--shadow-soft)] backdrop-blur">
        <Logo />
        <ul className="ml-6 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/join" className="hidden rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink sm:block">
            I have an invite
          </Link>
          <Link href="/access" className="rounded-lg px-3 py-2 text-sm whitespace-nowrap text-ink-2 hover:bg-paper-2 hover:text-ink">
            Sign in
          </Link>
          <ButtonLink href="/start" size="sm" className="px-4 whitespace-nowrap">
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Create a circle</span>
          </ButtonLink>
        </div>
      </nav>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-ink-2">
            A reminder and coordination tool for families — not a medical device and not a substitute for advice from a doctor or pharmacist. In an emergency, call your local emergency number.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-ink-2">
          <li><Link className="hover:text-ink" href="/start">Create a circle</Link></li>
          <li><Link className="hover:text-ink" href="/access">Sign in</Link></li>
          <li><Link className="hover:text-ink" href="/join">Join with invite</Link></li>
          <li><Link className="hover:text-ink" href="/#trust">Security</Link></li>
        </ul>
      </div>
    </footer>
  );
}

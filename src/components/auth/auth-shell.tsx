import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

/** Centred card on ruled paper, shared by every sign-in / sign-up screen. */
export function AuthShell({ title, eyebrow, description, children, footer, wide = false }: { title: ReactNode; eyebrow?: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="paper-ruled flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/" className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface hover:text-ink">
          ← Back home
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        <div className={`card animate-rise w-full ${wide ? "max-w-3xl" : "max-w-lg"} p-6 sm:p-10`}>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1 text-4xl leading-tight sm:text-5xl">{title}</h1>
          {description && <p className="mt-3 text-ink-2">{description}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      {footer && <div className="pb-10 text-center text-sm text-ink-2">{footer}</div>}
    </div>
  );
}

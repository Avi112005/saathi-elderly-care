import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" fill="none">
      <path d="M20 33s-11-6.6-11-14.4A6.2 6.2 0 0 1 20 14.7a6.2 6.2 0 0 1 11 3.9C31 26.4 20 33 20 33Z" stroke="var(--color-sky-600)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M12.5 20.5h4l2-3.4 3 6.4 2-2.9h4" stroke="var(--color-marigold-600)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", sub = true }: { href?: string; sub?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-lg">
      <LogoMark className="size-9 transition-transform duration-300 group-hover:-rotate-6" />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[1.65rem] text-ink">
          Saathi<span className="text-sky-600">.</span>
        </span>
        {sub && <span aria-hidden="true" lang="hi" className="mt-0.5 hidden text-[0.62rem] sm:block font-semibold tracking-[0.18em] text-ink-3 uppercase">साथी · care circle</span>}
      </span>
    </Link>
  );
}

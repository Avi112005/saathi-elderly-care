import { ButtonLink } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main id="main" className="paper-ruled flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <h1 className="text-5xl">This page wandered off.</h1>
      <p className="max-w-md text-ink-2">The link may be old, or the page may belong to a different care circle.</p>
      <ButtonLink href="/">Back to Saathi</ButtonLink>
    </main>
  );
}

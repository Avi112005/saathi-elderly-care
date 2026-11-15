"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/primitives";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" role="alert" className="paper-ruled flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-5xl">Something went wrong.</h1>
      <p className="max-w-md text-ink-2">Nothing you entered was lost. Please try again — if it keeps happening, the reference below helps us find it.</p>
      {error.digest && <code className="rounded-lg bg-paper-3 px-3 py-1 text-sm">{error.digest}</code>}
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}

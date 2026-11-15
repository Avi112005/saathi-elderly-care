export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div className="h-12 w-2/3 animate-pulse rounded-xl bg-paper-3" />
      <div className="h-5 w-1/2 animate-pulse rounded-lg bg-paper-3" />
      <div className="mt-6 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-paper-2" />
        ))}
      </div>
    </div>
  );
}

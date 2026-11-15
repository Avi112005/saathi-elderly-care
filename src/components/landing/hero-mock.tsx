import { Icon } from "@/components/ui/icon";

const ROWS = [
  { time: "8:00 AM", name: "Metformin 500 mg", note: "With breakfast", state: "taken" },
  { time: "9:00 AM", name: "Amlodipine 5 mg", note: "Blood pressure", state: "taken" },
  { time: "1:30 PM", name: "Ecosprin 75 mg", note: "After lunch", state: "live" },
  { time: "9:00 PM", name: "Atorvastatin 10 mg", note: "5 tablets left · refill", state: "later" },
] as const;

/** Decorative "Today" card for the hero. Purely illustrative, so it's hidden from assistive tech. */
export function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <p className="font-hand absolute -top-9 left-4 text-2xl text-sky-600">↓ Today, for Kamala Nani</p>
      <div className="animate-float absolute -top-14 -right-4 hidden rotate-[-6deg] rounded-xl border border-marigold-200 bg-marigold-100 px-3 py-2 font-hand text-xl text-marigold-800 shadow-[var(--shadow-soft)] sm:block">
        Priya saw it too ✓
      </div>

      <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-1.5 border-b border-line bg-paper-2 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-rose/70" />
          <span className="size-2.5 rounded-full bg-marigold-400/80" />
          <span className="size-2.5 rounded-full bg-sky-300" />
          <span className="ml-auto text-xs text-ink-3">Today · Thursday</span>
        </div>

        <div className="flex items-center gap-4 px-5 pt-5">
          <div className="relative grid size-16 place-items-center">
            <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
              <circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-paper-3)" strokeWidth="7" />
              <circle
                cx="32"
                cy="32"
                r="27"
                fill="none"
                stroke="var(--color-sage)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="169.6"
                strokeDashoffset="56"
              />
            </svg>
            <span className="absolute font-serif text-lg">2/3</span>
          </div>
          <div>
            <p className="font-serif text-2xl leading-tight">Good afternoon, Kamala</p>
            <p className="text-sm text-ink-2">Next: Ecosprin after lunch</p>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-line border-t border-line">
          {ROWS.map((r) => (
            <li key={r.name} className={`flex items-center gap-3 px-5 py-3 ${r.state === "live" ? "bg-sky-50" : ""}`}>
              <span className="w-16 shrink-0 text-xs font-semibold text-ink-3">{r.time}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className={`block truncate text-xs ${r.state === "later" ? "text-amber-700" : "text-ink-2"}`}>
                  {r.note}
                </span>
              </span>
              {r.state === "taken" && (
                <span className="check-draw grid size-8 place-items-center rounded-full bg-sage-100 text-sage-700">
                  <Icon name="check" className="size-4" strokeWidth={2.5} />
                </span>
              )}
              {r.state === "live" && (
                <span
                  className="rounded-lg px-3 py-1.5 text-xs font-bold [animation:demo-tick_5s_ease_infinite]"
                  style={{ border: "1px solid var(--color-line)" }}
                >
                  Taken
                </span>
              )}
              {r.state === "later" && <span className="text-xs text-ink-3">Later</span>}
            </li>
          ))}
        </ul>

        <div className="m-4 flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50 p-3">
          <Icon name="calendar" className="mt-0.5 size-5 text-sky-700" />
          <div className="text-sm">
            <p className="font-semibold">Cardiology follow-up · Sat 11:00</p>
            <p className="text-ink-2">3 questions noted for Dr. Mehta · Rahul is driving</p>
          </div>
        </div>
      </div>
    </div>
  );
}

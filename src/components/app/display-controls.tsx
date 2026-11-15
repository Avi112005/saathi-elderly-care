import { setDisplayPrefs } from "@/app/actions/settings";
import type { DisplayPrefs } from "@/lib/a11y";
import { Icon } from "@/components/ui/icon";

const SIZES = [
  { value: "md", label: "A", name: "Standard text" },
  { value: "lg", label: "A+", name: "Large text" },
  { value: "xl", label: "A++", name: "Extra large text" },
] as const;

/** Text-size and contrast switches. Plain forms, so they work even before JavaScript loads. */
export function DisplayControls({ prefs }: { prefs: DisplayPrefs }) {
  return (
    <div className="flex items-center gap-2">
      <form
        action={setDisplayPrefs}
        className="flex rounded-xl border border-line bg-surface p-0.5"
        aria-label="Text size"
      >
        {SIZES.map((s) => (
          <button
            key={s.value}
            name="textSize"
            value={s.value}
            aria-pressed={prefs.textSize === s.value}
            title={s.name}
            className={`min-h-9 min-w-9 rounded-lg px-2 font-serif transition-colors ${prefs.textSize === s.value ? "bg-ink text-white" : "text-ink-2 hover:bg-paper-2"}`}
          >
            <span aria-hidden="true">{s.label}</span>
            <span className="sr-only">{s.name}</span>
          </button>
        ))}
      </form>
      <form action={setDisplayPrefs}>
        <button
          name="contrast"
          value={prefs.contrast === "high" ? "normal" : "high"}
          aria-pressed={prefs.contrast === "high"}
          title="High contrast"
          className={`flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${prefs.contrast === "high" ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:bg-paper-2"}`}
        >
          <Icon name="contrast" className="size-4" />
          <span className="hidden sm:inline">High contrast</span>
          <span className="sr-only sm:hidden">High contrast</span>
        </button>
      </form>
    </div>
  );
}

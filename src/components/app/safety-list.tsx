import type { SafetyFinding } from "@/lib/domain/safety";
import { SAFETY_DISCLAIMER } from "@/lib/domain/safety";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/primitives";

const TONE = {
  high: { badge: "rose", label: "Important", border: "border-rose-100", icon: "text-rose-700" },
  moderate: { badge: "amber", label: "Check", border: "border-amber-100", icon: "text-amber-700" },
  info: { badge: "sage", label: "Good to know", border: "border-line", icon: "text-sage-700" },
} as const;

const KIND_LABEL: Record<SafetyFinding["kind"], string> = {
  interaction: "Interaction",
  allergy: "Allergy",
  senior: "Over-65 caution",
  duplicate: "Duplicate",
  spacing: "Timing",
};

export function SafetyList({ findings }: { findings: SafetyFinding[] }) {
  return (
    <div className="flex flex-col gap-3">
      {findings.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-sage-100 bg-sage-100/50 p-4 text-sage-700">
          <Icon name="shield" className="size-5" /> No known risks found in the current medicine list.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {findings.map((f) => {
            const t = TONE[f.severity];
            return (
              <li key={f.id} className={`card flex gap-3 p-4 ${t.border}`}>
                <Icon name={f.kind === "allergy" ? "alert" : "shield"} className={`mt-0.5 size-5 ${t.icon}`} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={t.badge}>{t.label}</Badge>
                    <span className="text-xs font-semibold tracking-wider text-ink-3 uppercase">
                      {KIND_LABEL[f.kind]}
                    </span>
                  </div>
                  <p className="mt-1.5 font-semibold">{f.title}</p>
                  <p className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">{f.medications.join(" + ")}:</span> {f.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-ink-2">{SAFETY_DISCLAIMER}</p>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { logDose, undoDoseAction } from "@/app/actions/medications";
import { IDLE } from "@/lib/actions";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/form";

export interface DoseCardData {
  medicationId: string;
  scheduledFor: string;
  timeLabel: string;
  state: "TAKEN" | "SKIPPED" | "MISSED" | "PENDING" | "OVERDUE";
  name: string;
  strength: string;
  doseLabel: string;
  foodLabel: string;
  instructions: string;
  appearance: string;
  pillColor: string;
  purpose: string;
  loggedBy: string | null;
  actedLabel: string | null;
  note: string;
  /** Doses more than 3 hours ahead can't be logged yet. */
  canLog: boolean;
  canAct: boolean;
}

export const PILL_SWATCH: Record<string, string> = {
  white: "#ffffff",
  yellow: "#f6dc6b",
  orange: "#f0a35a",
  pink: "#f3b4c7",
  red: "#d9574f",
  blue: "#7ea8e6",
  green: "#86c39a",
  brown: "#a8835d",
  purple: "#b49be0",
};

const SKIP_REASONS = ["Felt unwell", "Side effects", "Doctor advised", "Ran out", "Already took it earlier", "Other"];

const STATE_STYLE: Record<DoseCardData["state"], string> = {
  TAKEN: "border-sage-100 bg-sage-100/40",
  SKIPPED: "border-line bg-paper-2",
  MISSED: "border-rose-100 bg-rose-100/40",
  OVERDUE: "border-rose bg-surface ring-2 ring-rose-100",
  PENDING: "border-line bg-surface",
};

function Status({ dose }: { dose: DoseCardData }) {
  switch (dose.state) {
    case "TAKEN":
      return (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-sage-700">
          <Icon name="check" className="size-4" strokeWidth={2.5} /> Taken{dose.actedLabel ? ` at ${dose.actedLabel}` : ""}
          {dose.loggedBy ? ` · ${dose.loggedBy}` : ""}
        </p>
      );
    case "SKIPPED":
      return (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
          <Icon name="skip" className="size-4" /> Skipped{dose.note ? ` — ${dose.note}` : ""}
        </p>
      );
    case "MISSED":
      return (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
          <Icon name="alert" className="size-4" /> Missed — the circle was told
        </p>
      );
    case "OVERDUE":
      return (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
          <Icon name="clock" className="size-4" /> Overdue — not confirmed yet
        </p>
      );
    default:
      return <p className="text-sm text-ink-2">{dose.canLog ? "Due now or soon" : "Later today"}</p>;
  }
}

export function DoseCard({ dose }: { dose: DoseCardData }) {
  const [logState, logAction] = useActionState(logDose, IDLE);
  const [undoState, undoAction] = useActionState(undoDoseAction, IDLE);
  const [skipping, setSkipping] = useState(false);
  const done = dose.state === "TAKEN" || dose.state === "SKIPPED";
  const titleId = `dose-${dose.medicationId}-${dose.scheduledFor}`;
  const error = logState.status === "error" ? logState.message : undoState.status === "error" ? undoState.message : null;

  return (
    <article aria-labelledby={titleId} className={`rounded-2xl border p-4 transition-colors sm:p-5 ${STATE_STYLE[dose.state]}`}>
      <div className="flex gap-4">
        <div className="flex w-16 shrink-0 flex-col items-center gap-2 pt-0.5">
          <span className="text-sm font-bold text-ink">{dose.timeLabel}</span>
          <span
            aria-hidden="true"
            className="h-5 w-9 rounded-full border border-line-2 shadow-inner"
            style={{ background: PILL_SWATCH[dose.pillColor] ?? "#fff" }}
            title={dose.appearance}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="font-sans text-lg leading-snug font-semibold tracking-normal">
            {dose.name} {dose.strength && <span className="font-normal text-ink-2">{dose.strength}</span>}
          </h3>
          <p className="text-[0.95rem] text-ink">
            {dose.doseLabel}
            {dose.foodLabel && <span className="text-ink-2"> · {dose.foodLabel}</span>}
          </p>
          {(dose.purpose || dose.appearance) && (
            <p className="mt-0.5 text-sm text-ink-2">{[dose.purpose && `For ${dose.purpose.toLowerCase()}`, dose.appearance].filter(Boolean).join(" · ")}</p>
          )}
          {dose.instructions && <p className="mt-1 text-sm text-amber-700">{dose.instructions}</p>}
          <div className="mt-2">
            <Status dose={dose} />
          </div>
        </div>
      </div>

      {dose.canAct && (
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:pl-20">
          {!done && dose.canLog && !skipping && (
            <>
              <form action={logAction}>
                <input type="hidden" name="medicationId" value={dose.medicationId} />
                <input type="hidden" name="scheduledFor" value={dose.scheduledFor} />
                <input type="hidden" name="status" value="TAKEN" />
                <SubmitButton variant="success" size="lg" icon="check" pendingLabel="Saving…" aria-describedby={titleId}>
                  {dose.state === "MISSED" ? "Taken (late)" : "Taken"}
                </SubmitButton>
              </form>
              {dose.state !== "MISSED" && (
                <button type="button" onClick={() => setSkipping(true)} className="min-h-14 rounded-2xl px-4 font-semibold text-ink-2 hover:bg-paper-2" aria-describedby={titleId}>
                  Skip
                </button>
              )}
            </>
          )}
          {skipping && (
            <form action={logAction} className="flex w-full flex-wrap items-end gap-2">
              <input type="hidden" name="medicationId" value={dose.medicationId} />
              <input type="hidden" name="scheduledFor" value={dose.scheduledFor} />
              <input type="hidden" name="status" value="SKIPPED" />
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Why skip this dose?
                <select name="note" className="min-h-11 rounded-xl border border-line-2 bg-surface px-3 font-normal" defaultValue={SKIP_REASONS[0]}>
                  {SKIP_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <SubmitButton variant="secondary" pendingLabel="Saving…">
                Confirm skip
              </SubmitButton>
              <button type="button" onClick={() => setSkipping(false)} className="min-h-11 rounded-xl px-3 text-ink-2 hover:bg-paper-2">
                Cancel
              </button>
            </form>
          )}
          {done && (
            <form action={undoAction}>
              <input type="hidden" name="medicationId" value={dose.medicationId} />
              <input type="hidden" name="scheduledFor" value={dose.scheduledFor} />
              <SubmitButton variant="ghost" size="sm" icon="undo" pendingLabel="Undoing…" aria-describedby={titleId}>
                Undo
              </SubmitButton>
            </form>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-700 sm:pl-20">
          {error}
        </p>
      )}
    </article>
  );
}

"use client";

import { useActionState } from "react";
import { logRoutineAction, undoRoutineAction } from "@/app/actions/routines";
import { IDLE } from "@/lib/actions";
import { READING_RANGE, READING_UNIT, type RoutineKind, type VitalFlag } from "@/lib/domain/vitals";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

export interface RoutineCardData {
  routineId: string;
  scheduledFor: string;
  timeLabel: string;
  title: string;
  kind: RoutineKind;
  kindLabel: string;
  notes: string;
  status: "DONE" | "SKIPPED" | null;
  readingText: string;
  flag: VitalFlag;
  loggedBy: string | null;
  canLog: boolean;
  canAct: boolean;
}

const FLAG_BADGE: Record<VitalFlag, { tone: "sage" | "amber" | "rose"; label: string }> = {
  NORMAL: { tone: "sage", label: "In range" },
  LOW: { tone: "amber", label: "Low" },
  HIGH: { tone: "amber", label: "High" },
  URGENT: { tone: "rose", label: "Urgent" },
};

const numberInput = "min-h-12 w-24 rounded-xl border border-line-2 bg-surface px-3 text-lg tabular-nums focus:border-sky-500 focus:outline-none";

function Hidden({ data, status }: { data: RoutineCardData; status: "DONE" | "SKIPPED" }) {
  return (
    <>
      <input type="hidden" name="routineId" value={data.routineId} />
      <input type="hidden" name="scheduledFor" value={data.scheduledFor} />
      <input type="hidden" name="status" value={status} />
    </>
  );
}

/** One routine on the Today screen: tick off an activity, or type in a reading. */
export function RoutineCard({ data }: { data: RoutineCardData }) {
  const [state, action] = useActionState(logRoutineAction, IDLE);
  const [undoState, undo] = useActionState(undoRoutineAction, IDLE);
  const titleId = `routine-${data.routineId}-${data.scheduledFor}`;
  const measured = data.kind !== "ACTIVITY";
  const done = data.status !== null;

  return (
    <article aria-labelledby={titleId} className={`rounded-2xl border p-4 sm:p-5 ${data.status === "DONE" ? "border-sage-100 bg-sage-100/40" : data.status === "SKIPPED" ? "border-line bg-paper-2" : "border-line bg-surface"}`}>
      <div className="flex gap-4">
        <span className="w-16 shrink-0 pt-0.5 text-center text-sm font-bold">{data.timeLabel}</span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="flex items-center gap-2 font-sans text-lg font-semibold tracking-normal">
            <Icon name={measured ? "heartPulse" : "walk"} className="size-5 text-sky-600" />
            {data.title}
          </h3>
          <p className="text-sm text-ink-2">
            {data.kindLabel}
            {data.notes && ` · ${data.notes}`}
          </p>
          {data.status === "DONE" && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-sage-700">
              <Icon name="check" className="size-4" strokeWidth={2.5} />
              {data.readingText ? data.readingText : "Done"}
              {data.readingText && <Badge tone={FLAG_BADGE[data.flag].tone}>{FLAG_BADGE[data.flag].label}</Badge>}
              {data.loggedBy && <span className="font-normal text-ink-2">· {data.loggedBy}</span>}
            </p>
          )}
          {data.status === "SKIPPED" && <p className="mt-2 text-sm font-semibold text-ink-2">Skipped</p>}
        </div>
      </div>

      {data.canAct && (
        <div className="mt-4 sm:pl-20">
          {!done && data.canLog && (
            <div className="flex flex-wrap items-end gap-2">
              <form action={action} className="flex flex-wrap items-end gap-2">
                <Hidden data={data} status="DONE" />
                {data.kind === "BLOOD_PRESSURE" && (
                  <>
                    <label className="flex flex-col gap-1 text-sm font-semibold">
                      Top (systolic)
                      <input name="systolic" type="number" inputMode="numeric" required min={READING_RANGE.systolic[0]} max={READING_RANGE.systolic[1]} className={numberInput} />
                    </label>
                    <span aria-hidden="true" className="pb-3 text-2xl text-ink-3">/</span>
                    <label className="flex flex-col gap-1 text-sm font-semibold">
                      Bottom (diastolic)
                      <input name="diastolic" type="number" inputMode="numeric" required min={READING_RANGE.diastolic[0]} max={READING_RANGE.diastolic[1]} className={numberInput} />
                    </label>
                  </>
                )}
                {measured && data.kind !== "BLOOD_PRESSURE" && (
                  <label className="flex flex-col gap-1 text-sm font-semibold">
                    Reading ({READING_UNIT[data.kind]})
                    <input name="value" type="number" inputMode="decimal" step="0.1" required className={numberInput} />
                  </label>
                )}
                <SubmitButton variant="success" size="lg" icon="check" pendingLabel="Saving…" aria-describedby={titleId}>
                  {measured ? "Save reading" : "Done"}
                </SubmitButton>
              </form>
              <form action={action}>
                <Hidden data={data} status="SKIPPED" />
                <SubmitButton variant="ghost" size="lg" pendingLabel="…" aria-describedby={titleId}>
                  Skip
                </SubmitButton>
              </form>
            </div>
          )}
          {!done && !data.canLog && <p className="text-sm text-ink-2">Later today</p>}
          {done && (
            <form action={undo}>
              <input type="hidden" name="routineId" value={data.routineId} />
              <input type="hidden" name="scheduledFor" value={data.scheduledFor} />
              <SubmitButton variant="ghost" size="sm" icon="undo" pendingLabel="Undoing…" aria-describedby={titleId}>
                Undo
              </SubmitButton>
            </form>
          )}
          <FormMessage state={state.status !== "idle" ? state : undoState} className="mt-3" />
        </div>
      )}
    </article>
  );
}

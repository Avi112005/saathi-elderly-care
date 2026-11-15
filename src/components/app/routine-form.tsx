"use client";

import { useActionState, useState } from "react";
import { saveRoutineAction, stopRoutineAction } from "@/app/actions/routines";
import { IDLE } from "@/lib/actions";
import { ROUTINE_KINDS, ROUTINE_KIND_LABEL } from "@/lib/domain/vitals";
import { FormMessage, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { DaysField, TimesField } from "./schedule-fields";

export interface RoutineFormValues {
  id?: string;
  title: string;
  kind: string;
  times: string[];
  daysOfWeek: number[];
  startDate: string;
  endDate: string;
  notes: string;
}

const SUGGESTIONS = [
  { title: "Check blood pressure", kind: "BLOOD_PRESSURE", times: ["08:30"] },
  { title: "Fasting blood sugar", kind: "BLOOD_SUGAR", times: ["07:00"] },
  { title: "Evening walk", kind: "ACTIVITY", times: ["18:00"] },
  { title: "Physiotherapy exercises", kind: "ACTIVITY", times: ["10:00"] },
] as const;

export function RoutineForm({ initial }: { initial: RoutineFormValues }) {
  const [state, action] = useActionState(saveRoutineAction, IDLE);
  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState(initial.kind);
  const [times, setTimes] = useState<string[]>(initial.times);
  const [days, setDays] = useState<number[]>(initial.daysOfWeek);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {!initial.id && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Common routines">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => {
                setTitle(s.title);
                setKind(s.kind);
                setTimes([...s.times]);
              }}
              className="min-h-10 rounded-full border border-line-2 bg-surface px-3.5 text-sm font-semibold hover:border-sky-300 hover:bg-sky-50"
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField
          label="Routine"
          name="title"
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          placeholder="Check blood pressure"
          required
          errors={e.title}
          maxLength={80}
        />
        <SelectField
          label="Type"
          name="kind"
          value={kind}
          onChange={(ev) => setKind(ev.target.value)}
          options={ROUTINE_KINDS.map((k) => ({ value: k, label: ROUTINE_KIND_LABEL[k] }))}
          hint={
            kind === "ACTIVITY"
              ? "Ticked off as done."
              : "A reading is recorded each time and checked against safe ranges."
          }
          errors={e.kind}
        />
      </div>

      <TimesField label="Times" itemLabel="Routine time" times={times} onChange={setTimes} max={6} errors={e.times} />
      <DaysField days={days} onChange={setDays} errors={e.daysOfWeek} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={initial.startDate}
          required
          errors={e.startDate}
        />
        <TextField
          label="End date"
          name="endDate"
          type="date"
          defaultValue={initial.endDate}
          hint="Leave empty for ongoing."
          errors={e.endDate}
        />
      </div>
      <TextArea
        label="Notes"
        name="notes"
        defaultValue={initial.notes}
        placeholder="Sit quietly for 5 minutes first. Left arm."
        errors={e.notes}
        maxLength={300}
      />
      <FormMessage state={state} />
      <div>
        <SubmitButton size="lg" icon="check">
          {initial.id ? "Save routine" : "Add routine"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function StopRoutineButton({ id }: { id: string }) {
  const [state, action] = useActionState(stopRoutineAction, IDLE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div>
        <SubmitButton variant="danger" icon="stop" pendingLabel="Stopping…">
          Stop this routine
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { saveMedication } from "@/app/actions/medications";
import { IDLE } from "@/lib/actions";
import { FOOD_TIMINGS, FOOD_TIMING_LABEL, MED_FORMS, MED_FORM_LABEL, PILL_COLORS } from "@/lib/domain/types";
import { FormMessage, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { PILL_SWATCH } from "./dose-card";

export interface MedicationFormValues {
  id?: string;
  name: string;
  strength: string;
  form: string;
  doseQuantity: number;
  doseUnit: string;
  times: string[];
  daysOfWeek: number[];
  startDate: string;
  endDate: string;
  foodTiming: string;
  instructions: string;
  purpose: string;
  prescriber: string;
  appearance: string;
  pillColor: string;
  stockCount: string;
  refillAt: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRESETS: { label: string; times: string[] }[] = [
  { label: "Once a day", times: ["08:00"] },
  { label: "Twice a day", times: ["08:00", "20:00"] },
  { label: "Three times", times: ["08:00", "14:00", "20:00"] },
  { label: "Bedtime", times: ["21:30"] },
];

export function MedicationForm({ initial, consentRequired }: { initial: MedicationFormValues; consentRequired: boolean }) {
  const [state, action] = useActionState(saveMedication, IDLE);
  const [times, setTimes] = useState<string[]>(initial.times.length ? initial.times : ["08:00"]);
  const [days, setDays] = useState<number[]>(initial.daysOfWeek);
  const [color, setColor] = useState(initial.pillColor);
  const e = state.fieldErrors ?? {};
  const isEdit = Boolean(initial.id);

  return (
    <form action={action} className="flex flex-col gap-8" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      {consentRequired && (
        <p className="flex items-start gap-3 rounded-xl border border-marigold-200 bg-marigold-50 p-4 text-sm">
          <Icon name="heart" className="mt-0.5 size-5 text-marigold-800" />
          <span>Consent mode is on — this will be sent to the elder to approve. Nothing changes until they say yes.</span>
        </p>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-serif text-2xl">The medicine</legend>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <TextField label="Medicine name" name="name" defaultValue={initial.name} placeholder="e.g. Metformin or Glycomet" required errors={e.name} maxLength={80} autoComplete="off" />
          <TextField label="Strength" name="strength" defaultValue={initial.strength} placeholder="500 mg" errors={e.strength} maxLength={40} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Form" name="form" defaultValue={initial.form} options={MED_FORMS.map((f) => ({ value: f, label: MED_FORM_LABEL[f] }))} errors={e.form} />
          <TextField label="Amount per dose" name="doseQuantity" type="number" step="0.25" min="0.25" max="50" defaultValue={initial.doseQuantity} required errors={e.doseQuantity} />
          <TextField label="Unit" name="doseUnit" defaultValue={initial.doseUnit} placeholder="tablet, ml, puff…" required errors={e.doseUnit} maxLength={20} />
        </div>
        <TextField label="What it's for" name="purpose" defaultValue={initial.purpose} placeholder="Blood pressure" hint="Shown in plain words next to every dose." errors={e.purpose} maxLength={120} />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-serif text-2xl">When to take it</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick schedules">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setTimes(p.times)} className="min-h-10 rounded-full border border-line-2 bg-surface px-3.5 text-sm font-semibold hover:border-sky-300 hover:bg-sky-50">
              {p.label}
            </button>
          ))}
        </div>
        <div>
          <p id="times-label" className="text-sm font-semibold">
            Times <span className="font-normal text-ink-2">(in the elder&apos;s time zone)</span>
          </p>
          <ul aria-labelledby="times-label" className="mt-2 flex flex-wrap gap-2">
            {times.map((t, i) => (
              <li key={i} className="flex items-center gap-1 rounded-xl border border-line-2 bg-surface py-1 pr-1 pl-3">
                <input
                  type="time"
                  name="times"
                  value={t}
                  required
                  aria-label={`Dose time ${i + 1}`}
                  onChange={(ev) => setTimes(times.map((x, j) => (j === i ? ev.target.value : x)))}
                  className="min-h-9 bg-transparent text-base focus:outline-none"
                />
                {times.length > 1 && (
                  <button type="button" onClick={() => setTimes(times.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-rose-100 hover:text-rose-700" aria-label={`Remove time ${i + 1}`}>
                    <Icon name="x" className="size-4" />
                  </button>
                )}
              </li>
            ))}
            {times.length < 8 && (
              <li>
                <button type="button" onClick={() => setTimes([...times, "12:00"])} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-line-2 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50">
                  <Icon name="plus" className="size-4" /> Add a time
                </button>
              </li>
            )}
          </ul>
          {e.times && <p className="mt-1.5 text-sm font-medium text-rose-700" role="alert">{e.times.join(" ")}</p>}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">Days</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const value = i + 1;
              const on = days.includes(value);
              return (
                <label key={d} className={`grid min-h-11 min-w-12 cursor-pointer place-items-center rounded-xl border px-2 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-300 ${on ? "border-sky-500 bg-sky-600 text-white" : "border-line-2 bg-surface text-ink-2"}`}>
                  <input type="checkbox" name="daysOfWeek" value={value} checked={on} onChange={() => setDays(on ? days.filter((x) => x !== value) : [...days, value].sort())} className="sr-only" />
                  {d}
                </label>
              );
            })}
          </div>
          {e.daysOfWeek && <p className="mt-1.5 text-sm font-medium text-rose-700" role="alert">{e.daysOfWeek.join(" ")}</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Food" name="foodTiming" defaultValue={initial.foodTiming} options={FOOD_TIMINGS.map((f) => ({ value: f, label: FOOD_TIMING_LABEL[f] }))} errors={e.foodTiming} />
          <TextField label="Start date" name="startDate" type="date" defaultValue={initial.startDate} required errors={e.startDate} />
          <TextField label="End date" name="endDate" type="date" defaultValue={initial.endDate} hint="Leave empty for ongoing." errors={e.endDate} />
        </div>
        <TextArea label="Special instructions" name="instructions" defaultValue={initial.instructions} placeholder="Swallow whole. Don't take with grapefruit juice." errors={e.instructions} maxLength={300} />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-serif text-2xl">Recognising it</legend>
        <TextField label="What the pill looks like" name="appearance" defaultValue={initial.appearance} placeholder="Small round white tablet with a line" hint="Helps the elder pick the right pill from the organiser." errors={e.appearance} maxLength={80} />
        <fieldset>
          <legend className="text-sm font-semibold">Colour</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PILL_COLORS.map((c) => (
              <label key={c} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm capitalize has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-300 ${color === c ? "border-sky-500 bg-sky-50 font-semibold" : "border-line-2 bg-surface"}`}>
                <input type="radio" name="pillColor" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only" />
                <span aria-hidden="true" className="size-4 rounded-full border border-line-2" style={{ background: PILL_SWATCH[c] }} />
                {c}
              </label>
            ))}
          </div>
        </fieldset>
        <TextField label="Prescribed by" name="prescriber" defaultValue={initial.prescriber} placeholder="Dr. Mehta" errors={e.prescriber} maxLength={80} />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-serif text-2xl">Stock &amp; refills</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Units on hand" name="stockCount" type="number" min="0" step="0.5" defaultValue={initial.stockCount} hint="Leave empty if you don't track stock. Decreases as doses are taken." errors={e.stockCount} />
          <TextField label="Remind to refill with … days left" name="refillAt" type="number" min="0" max="90" defaultValue={initial.refillAt} errors={e.refillAt} />
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton size="lg" icon="check" pendingLabel={consentRequired ? "Sending…" : "Saving…"}>
          {consentRequired ? "Send for approval" : isEdit ? "Save changes" : "Add medicine"}
        </SubmitButton>
      </div>
    </form>
  );
}

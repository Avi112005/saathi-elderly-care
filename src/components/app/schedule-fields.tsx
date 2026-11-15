"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const NEW_TIME = "12:00";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="mt-1.5 text-sm font-medium text-rose-700" role="alert">
      {errors.join(" ")}
    </p>
  );
}

interface TimesFieldProps {
  label: ReactNode;
  /** Used in each input's accessible name, e.g. "Dose time 1". */
  itemLabel: string;
  times: string[];
  onChange: (times: string[]) => void;
  max: number;
  errors?: string[];
}

/** An editable list of "HH:MM" times, submitted as repeated `times` form fields. */
export function TimesField({ label, itemLabel, times, onChange, max, errors }: TimesFieldProps) {
  const labelId = useId();
  const update = (index: number, value: string) => onChange(times.map((t, i) => (i === index ? value : t)));
  const remove = (index: number) => onChange(times.filter((_, i) => i !== index));

  return (
    <div>
      <p id={labelId} className="text-sm font-semibold">
        {label}
      </p>
      <ul aria-labelledby={labelId} className="mt-2 flex flex-wrap gap-2">
        {times.map((time, index) => (
          <li key={index} className="flex items-center gap-1 rounded-xl border border-line-2 bg-surface py-1 pr-1 pl-3">
            <input
              type="time"
              name="times"
              value={time}
              required
              aria-label={`${itemLabel} ${index + 1}`}
              onChange={(event) => update(index, event.target.value)}
              className="min-h-9 bg-transparent text-base focus:outline-none"
            />
            {times.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-rose-100 hover:text-rose-700"
                aria-label={`Remove time ${index + 1}`}
              >
                <Icon name="x" className="size-4" />
              </button>
            )}
          </li>
        ))}
        {times.length < max && (
          <li>
            <button
              type="button"
              onClick={() => onChange([...times, NEW_TIME])}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-line-2 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
            >
              <Icon name="plus" className="size-4" /> Add a time
            </button>
          </li>
        )}
      </ul>
      <FieldError errors={errors} />
    </div>
  );
}

interface DaysFieldProps {
  /** ISO weekdays, Monday = 1 … Sunday = 7. */
  days: number[];
  onChange: (days: number[]) => void;
  errors?: string[];
}

/** Weekday toggle buttons, submitted as repeated `daysOfWeek` form fields. */
export function DaysField({ days, onChange, errors }: DaysFieldProps) {
  const toggle = (day: number) =>
    onChange(days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b));

  return (
    <fieldset>
      <legend className="text-sm font-semibold">Days</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {WEEKDAYS.map((name, index) => {
          const day = index + 1;
          const selected = days.includes(day);
          const tone = selected ? "border-sky-500 bg-sky-600 text-white" : "border-line-2 bg-surface text-ink-2";
          return (
            <label
              key={name}
              className={`grid min-h-11 min-w-12 cursor-pointer place-items-center rounded-xl border px-2 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-300 ${tone}`}
            >
              <input
                type="checkbox"
                name="daysOfWeek"
                value={day}
                checked={selected}
                onChange={() => toggle(day)}
                className="sr-only"
              />
              {name}
            </label>
          );
        })}
      </div>
      <FieldError errors={errors} />
    </fieldset>
  );
}

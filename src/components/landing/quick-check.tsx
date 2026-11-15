"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

const OPTIONS = [
  {
    id: "a",
    text: "Emails the whole family the moment she's a minute late",
    correct: false,
    why: "That would turn every slow morning into a family alarm — and soon everyone stops reading.",
  },
  {
    id: "b",
    text: "Reminds her first, nudges her caretaker after 30 minutes, tells the family after 2 hours",
    correct: true,
    why: "Exactly. The elder hears first, the circle widens only when it really matters — and every step is logged.",
  },
  {
    id: "c",
    text: "Nothing — reminders are her own responsibility",
    correct: false,
    why: "One missed blood-pressure dose is usually fine. A week of them isn't. Someone should notice.",
  },
] as const;

/** A small interactive quiz, mirroring the "check your understanding" moment in a lesson. */
export function QuickCheck() {
  const [picked, setPicked] = useState<string | null>(null);
  const choice = OPTIONS.find((o) => o.id === picked);

  return (
    <div className="card relative mx-auto max-w-2xl border-marigold-200 bg-marigold-50 p-6 sm:p-8">
      <p className="font-hand text-2xl text-marigold-800">Quick check — just like a care visit</p>
      <h3 id="quick-check-q" className="mt-2 text-2xl leading-snug sm:text-3xl">
        What does Saathi do when Nani hasn&apos;t confirmed her 8 PM dose?
      </h3>
      <div role="radiogroup" aria-labelledby="quick-check-q" className="mt-5 flex flex-col gap-2.5">
        {OPTIONS.map((o) => {
          const selected = picked === o.id;
          const state = selected
            ? o.correct
              ? "border-sage bg-sage-100 text-sage-700"
              : "border-rose bg-rose-100 text-rose-700"
            : "border-line bg-surface hover:border-sky-300";
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPicked(o.id)}
              className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${state}`}
            >
              <span>{o.text}</span>
              {selected && <Icon name={o.correct ? "check" : "x"} className="size-5" />}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-4 min-h-6 text-ink-2">
        {choice ? (
          <>
            <strong className={choice.correct ? "text-sage-700" : "text-rose-700"}>
              {choice.correct ? "Right. " : "Not quite. "}
            </strong>
            {choice.why}
          </>
        ) : null}
      </p>
    </div>
  );
}

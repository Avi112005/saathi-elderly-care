"use client";

import { useActionState } from "react";
import { findCircle } from "@/app/actions/auth";
import { IDLE } from "@/lib/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";

export function CareCodeForm({ next }: { next?: string }) {
  const [state, action] = useActionState(findCircle, IDLE);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <TextField
        label="Care code"
        name="careCode"
        placeholder="K7QM-4XPA"
        hint="8 letters and numbers, on the welcome email or from whoever set up the circle."
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        required
        errors={state.fieldErrors?.careCode}
        className="[&_input]:font-mono [&_input]:text-2xl [&_input]:tracking-[0.2em] [&_input]:uppercase"
      />
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Finding your circle…" icon="arrowRight">
        Continue
      </SubmitButton>
    </form>
  );
}

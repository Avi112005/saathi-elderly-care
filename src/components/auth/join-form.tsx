"use client";

import { useActionState } from "react";
import { joinCircle } from "@/app/actions/auth";
import { IDLE } from "@/lib/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";

export function JoinForm({ code }: { code?: string }) {
  const [state, action] = useActionState(joinCircle, IDLE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <TextField
        label="Invite code"
        name="inviteCode"
        defaultValue={code}
        placeholder="JOIN-8KD2-QF7M-4XPA"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        errors={e.inviteCode}
        hint="Single-use and valid for 72 hours."
        className="[&_input]:font-mono [&_input]:tracking-wider [&_input]:uppercase"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Your name" name="name" autoComplete="name" required errors={e.name} maxLength={60} />
        <TextField label="Relationship" name="relationship" placeholder="Daughter, nurse…" errors={e.relationship} maxLength={40} />
      </div>
      <TextField label="Your email" name="email" type="email" autoComplete="email" hint="Where your reminders and alerts go." errors={e.email} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Choose a PIN" name="pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} required hint="6–8 digits." errors={e.pin} />
        <TextField label="Type it again" name="confirmPin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} required errors={e.confirmPin} />
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Joining…" icon="users">
        Join the circle
      </SubmitButton>
    </form>
  );
}

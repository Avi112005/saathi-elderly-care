"use client";

import { useActionState, useState } from "react";
import { startCircle } from "@/app/actions/auth";
import { IDLE } from "@/lib/actions";
import { Checkbox, FormMessage, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import { TimezoneSelect } from "./timezone-select";

type SetupFor = "SELF" | "LOVED_ONE";

const CHOICES: { value: SetupFor; title: string; sub: string; icon: IconName }[] = [
  { value: "LOVED_ONE", title: "Someone I care for", sub: "A parent, grandparent or patient", icon: "users" },
  { value: "SELF", title: "Myself", sub: "I want to manage my own medicines", icon: "heart" },
];

export function StartForm({ zones }: { zones: string[] }) {
  const [state, action] = useActionState(startCircle, IDLE);
  const [setupFor, setSetupFor] = useState<SetupFor>("LOVED_ONE");
  const e = state.fieldErrors ?? {};
  const self = setupFor === "SELF";

  return (
    <form action={action} className="flex flex-col gap-8" noValidate>
      <fieldset>
        <legend className="text-sm font-semibold">Who is this care circle for?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CHOICES.map((c) => (
            <label
              key={c.value}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4 has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-300"
            >
              <input
                type="radio"
                name="setupFor"
                value={c.value}
                checked={setupFor === c.value}
                onChange={() => setSetupFor(c.value)}
                className="mt-1 size-4 accent-sky-600"
              />
              <span>
                <span className="flex items-center gap-2 font-semibold">
                  <Icon name={c.icon} className="size-4 text-sky-600" />
                  {c.title}
                </span>
                <span className="text-sm text-ink-2">{c.sub}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="elder-heading" className="flex flex-col gap-4">
        <h2 id="elder-heading" className="text-2xl">
          {self ? "About you" : "About them"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Full name"
            name="elderFullName"
            autoComplete={self ? "name" : "off"}
            required
            errors={e.elderFullName}
            maxLength={80}
          />
          <TextField
            label={self ? "What should we call you?" : "What do they like to be called?"}
            name="elderPreferredName"
            placeholder="Nani, Appa, Kamala…"
            required
            errors={e.elderPreferredName}
            maxLength={40}
          />
          <TextField
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            hint="Used for age-specific safety checks (65+)."
            errors={e.dateOfBirth}
          />
          <TimezoneSelect zones={zones} errors={e.timezone} />
        </div>
        <TextArea
          label="Health conditions"
          name="conditions"
          placeholder="e.g. Type 2 diabetes, high blood pressure"
          errors={e.conditions}
          maxLength={500}
        />
        <TextField
          label="Allergies"
          name="allergies"
          placeholder="e.g. Penicillin, sulfa"
          hint="Saathi checks new medicines against these."
          errors={e.allergies}
          maxLength={300}
        />
      </section>

      <section aria-labelledby="you-heading" className="flex flex-col gap-4">
        <h2 id="you-heading" className="text-2xl">
          {self ? "Your sign-in" : "About you"}
        </h2>
        {!self && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Your name"
              name="yourName"
              autoComplete="name"
              required
              errors={e.yourName}
              maxLength={60}
            />
            <TextField
              label="Your relationship"
              name="relationship"
              placeholder="Son, daughter, nurse…"
              errors={e.relationship}
              maxLength={40}
            />
          </div>
        )}
        <TextField
          label="Your email"
          name="email"
          type="email"
          autoComplete="email"
          hint="Reminders and alerts are sent here. Optional, but recommended."
          errors={e.email}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Choose a PIN"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={8}
            hint="6–8 digits, not 123456."
            required
            errors={e.pin}
          />
          <TextField
            label="Type it again"
            name="confirmPin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={8}
            required
            errors={e.confirmPin}
          />
        </div>
      </section>

      {!self && (
        <section
          aria-labelledby="elder-access-heading"
          className="flex flex-col gap-4 rounded-2xl border border-dashed border-line-2 bg-paper p-5"
        >
          <div>
            <h2 id="elder-access-heading" className="text-2xl">
              Their own sign-in <span className="font-sans text-sm text-ink-3">(recommended)</span>
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Give them a PIN so they can tick off doses and approve changes themselves. Leave blank if they won&apos;t
              use Saathi directly.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Their PIN"
              name="elderPin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              errors={e.elderPin}
            />
            <TextField
              label="Their email"
              name="elderEmail"
              type="email"
              autoComplete="off"
              hint="For their own dose reminders."
              errors={e.elderEmail}
            />
          </div>
        </section>
      )}

      <Checkbox
        name="consentMode"
        defaultChecked
        label={self ? "I approve every medicine change" : "They approve every medicine change (consent mode)"}
        description="Changes others make to medicines wait for the elder's yes. Needs the elder's own PIN."
      />

      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Creating your circle…" icon="heart">
        Create care circle
      </SubmitButton>
      <p className="text-sm text-ink-2">
        Health details stay inside this circle — only people you invite can see them. Saathi is a reminder tool, not
        medical advice.
      </p>
    </form>
  );
}

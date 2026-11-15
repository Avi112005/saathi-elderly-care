"use client";

import { useActionState, useRef, useState } from "react";
import { signIn } from "@/app/actions/auth";
import { IDLE } from "@/lib/actions";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Avatar } from "@/components/ui/primitives";

interface MemberOption {
  id: string;
  name: string;
  roleLabel: string;
  avatarColor: string;
}

/** "Who's checking in?" — pick yourself, then enter your PIN. */
export function PinSignIn({ careCode, members, next }: { careCode: string; members: MemberOption[]; next?: string }) {
  const [state, action] = useActionState(signIn, IDLE);
  const [memberId, setMemberId] = useState<string>(members.length === 1 ? members[0]!.id : "");
  const pinRef = useRef<HTMLInputElement>(null);
  const selected = members.find((m) => m.id === memberId);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="careCode" value={careCode} />
      <input type="hidden" name="memberId" value={memberId} />
      {next && <input type="hidden" name="next" value={next} />}

      <fieldset>
        <legend className="text-sm font-semibold">Who&apos;s checking in?</legend>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {members.map((m) => {
            const active = m.id === memberId;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setMemberId(m.id);
                  requestAnimationFrame(() => pinRef.current?.focus());
                }}
                className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-all ${active ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200" : "border-line bg-surface hover:border-sky-300"}`}
              >
                <Avatar name={m.name} color={m.avatarColor} size="lg" />
                <span className="font-semibold leading-tight">{m.name}</span>
                <span className="text-xs text-ink-2">{m.roleLabel}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="pin" className="text-sm font-semibold">
          {selected ? `${selected.name}'s PIN` : "Choose yourself above first"}
        </label>
        <input
          ref={pinRef}
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="[0-9]*"
          maxLength={8}
          required
          disabled={!selected}
          aria-invalid={state.fieldErrors?.pin ? true : undefined}
          aria-describedby="pin-help"
          className="mt-1.5 w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-center font-mono text-3xl tracking-[0.5em] focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-paper-2 aria-[invalid=true]:border-rose"
        />
        <p id="pin-help" className="mt-1.5 text-sm text-ink-2">
          6–8 digits. Forgot it? Ask the person who manages your circle to reset access.
        </p>
      </div>

      <FormMessage state={state} />
      <SubmitButton size="lg" disabled={!selected} pendingLabel="Checking…" icon="key">
        Open care circle
      </SubmitButton>
    </form>
  );
}

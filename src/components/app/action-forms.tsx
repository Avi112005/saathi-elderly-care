"use client";

import { useActionState, type ReactNode } from "react";
import { decideRequest, inviteMember, revokeInvite, setConsentMode, updateMemberAccess } from "@/app/actions/circle";
import { runRemindersNow, sendTestEmail } from "@/app/actions/settings";
import { addStock, stopMedication } from "@/app/actions/medications";
import { IDLE, type ActionState } from "@/lib/actions";
import { FormMessage, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import type { ButtonVariant } from "@/components/ui/primitives";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** A one-button form bound to a server action, with its result announced underneath. */
function ActionButton({
  action,
  children,
  icon,
  variant = "secondary",
  pendingLabel,
  hidden = {},
}: {
  action: Action;
  children: ReactNode;
  icon?: IconName;
  variant?: ButtonVariant;
  pendingLabel?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div>
        <SubmitButton variant={variant} icon={icon} pendingLabel={pendingLabel ?? "Working…"}>
          {children}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RunRemindersButton() {
  return (
    <ActionButton action={(p) => runRemindersNow(p)} icon="refresh" pendingLabel="Checking…">
      Run reminder check now
    </ActionButton>
  );
}

export function TestEmailButton() {
  return (
    <ActionButton action={(p) => sendTestEmail(p)} icon="send" pendingLabel="Sending…">
      Send me a test email
    </ActionButton>
  );
}

export function StopMedicationButton({ id, consent }: { id: string; consent: boolean }) {
  return (
    <ActionButton action={stopMedication} icon="stop" variant="danger" hidden={{ id }} pendingLabel="Stopping…">
      {consent ? "Ask to stop this medicine" : "Stop this medicine"}
    </ActionButton>
  );
}

export function AddStockForm({ id, unit }: { id: string; unit: string }) {
  const [state, action] = useActionState(addStock, IDLE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-end gap-2">
        <TextField
          label={`Add ${unit}s after a refill`}
          name="amount"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          required
          className="w-44"
        />
        <SubmitButton variant="secondary" icon="box" pendingLabel="Adding…">
          Add stock
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RequestDecision({ id, canDecide }: { id: string; canDecide: boolean }) {
  const [state, action] = useActionState(decideRequest, IDLE);
  if (!canDecide) {
    return <p className="text-sm text-ink-2">Waiting for the elder to approve. Nothing changes until they do.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="APPROVED" variant="success" icon="check" pendingLabel="Saving…">
          Approve
        </SubmitButton>
        <SubmitButton name="decision" value="DECLINED" variant="secondary" pendingLabel="Saving…">
          Not now
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function ConsentToggle({
  enabled,
  canDisable,
  canEnable,
}: {
  enabled: boolean;
  canDisable: boolean;
  canEnable: boolean;
}) {
  const [state, action] = useActionState(setConsentMode, IDLE);
  const allowed = enabled ? canDisable : canEnable;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="enable" value={enabled ? "false" : "true"} />
      <div>
        <SubmitButton
          variant={enabled ? "secondary" : "primary"}
          disabled={!allowed}
          pendingLabel="Saving…"
          icon="heart"
        >
          {enabled ? "Turn consent mode off" : "Turn consent mode on"}
        </SubmitButton>
      </div>
      {!allowed && (
        <p className="text-sm text-ink-2">
          {enabled ? "Only the elder can turn this off." : "Only a circle admin can turn this on."}
        </p>
      )}
      <FormMessage state={state} />
    </form>
  );
}

export function InviteForm() {
  const [state, action] = useActionState(inviteMember, IDLE);
  const code = state.status === "success" ? state.data?.code : undefined;
  const careCode = state.data?.careCode;

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <SelectField
          label="Role"
          name="role"
          options={[
            { value: "FAMILY", label: "Family — view, log doses, appointments" },
            { value: "CARETAKER", label: "Caretaker — also manages medicines" },
          ]}
        />
        <TextField label="For (optional)" name="label" placeholder="e.g. Anita (daughter)" maxLength={60} />
        <SubmitButton icon="plus" pendingLabel="Creating…">
          Create invite
        </SubmitButton>
      </form>
      {code ? (
        <div role="status" className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-5">
          <p className="text-sm font-semibold text-sky-800">
            Share this invite now — it&apos;s shown only once and works for 72 hours.
          </p>
          <p className="mt-2 font-mono text-2xl tracking-wider select-all sm:text-3xl">{code}</p>
          <p className="mt-2 text-sm text-ink-2">
            They open Saathi → “I have an invite”, enter this code and choose their own PIN. After that they sign in
            with care code <strong className="font-mono">{careCode}</strong>.
          </p>
          <CopyButton
            text={`You're invited to a Saathi care circle. Open ${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${code} and choose your own PIN. Invite code: ${code}`}
          />
        </div>
      ) : (
        <FormMessage state={state} />
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        void navigator.clipboard?.writeText(text);
        const btn = e.currentTarget;
        btn.dataset.copied = "true";
        setTimeout(() => (btn.dataset.copied = "false"), 2000);
      }}
      className="group mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3 text-sm font-semibold hover:bg-paper-2"
    >
      <Icon name="copy" className="size-4" />
      <span className="group-data-[copied=true]:hidden">Copy invite message</span>
      <span className="hidden group-data-[copied=true]:inline" aria-live="polite">
        Copied!
      </span>
    </button>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  return (
    <ActionButton action={revokeInvite} hidden={{ id }} variant="ghost" icon="x" pendingLabel="Revoking…">
      Revoke
    </ActionButton>
  );
}

export function MemberControls({ id, role, locked }: { id: string; role: string; locked: boolean }) {
  const [state, action] = useActionState(updateMemberAccess, IDLE);
  return (
    <form action={action} className="flex flex-col items-start gap-2 sm:items-end">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-1.5">
        {locked && (
          <SubmitButton name="intent" value="unlock" variant="secondary" size="sm" pendingLabel="…">
            Unlock
          </SubmitButton>
        )}
        <input type="hidden" name="role" value={role === "CARETAKER" ? "FAMILY" : "CARETAKER"} />
        <SubmitButton name="intent" value="role" variant="ghost" size="sm" pendingLabel="…">
          Make {role === "CARETAKER" ? "family" : "caretaker"}
        </SubmitButton>
        <SubmitButton
          name="intent"
          value="remove"
          variant="danger"
          size="sm"
          pendingLabel="…"
          onClick={(e) => {
            if (!window.confirm("Remove this person's access to the care circle?")) e.preventDefault();
          }}
        >
          Remove
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

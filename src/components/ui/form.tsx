"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/actions";
import { Button, type ButtonSize, type ButtonVariant } from "./primitives";
import { Icon, type IconName } from "./icon";

const control =
  "w-full rounded-xl border border-line-2 bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-3 shadow-[inset_0_1px_2px_rgb(30_41_66/0.06)] transition-colors hover:border-sky-300 focus:border-sky-500 focus:outline-none focus-visible:outline-3 focus-visible:outline-sky-500/40 aria-[invalid=true]:border-rose aria-[invalid=true]:bg-rose-100/30";

interface FieldProps {
  label: string;
  name: string;
  hint?: ReactNode;
  errors?: string[];
  required?: boolean;
  className?: string;
}

/** Label + control + hint + error, wired together with ids for screen readers. */
function FieldShell({
  label,
  hint,
  errors,
  required,
  className = "",
  id,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="text-rose-700" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !errors?.length && (
        <p id={`${id}-hint`} className="text-sm text-ink-2">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-medium text-rose-700">
          <Icon name="alert" className="mt-0.5 size-4" />
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, errors?: string[]) {
  if (errors?.length) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

export function TextField({
  label,
  name,
  hint,
  errors,
  required,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<"input">, "name">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} name={name} hint={hint} errors={errors} required={required} className={className}>
      <input
        id={id}
        name={name}
        required={required}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        className={control}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  name,
  hint,
  errors,
  required,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<"textarea">, "name">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} name={name} hint={hint} errors={errors} required={required} className={className}>
      <textarea
        id={id}
        name={name}
        required={required}
        rows={3}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        className={`${control} resize-y`}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  hint,
  errors,
  required,
  className,
  options,
  ...props
}: FieldProps & Omit<ComponentProps<"select">, "name"> & { options: readonly { value: string; label: string }[] }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} name={name} hint={hint} errors={errors} required={required} className={className}>
      <div className="relative">
        <select
          id={id}
          name={name}
          required={required}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={describedBy(id, hint, errors)}
          className={`${control} appearance-none pr-10`}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </FieldShell>
  );
}

export function Checkbox({
  label,
  name,
  description,
  defaultChecked,
  ...props
}: { label: string; name: string; description?: string } & Omit<ComponentProps<"input">, "name" | "type">) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 has-[:checked]:border-sky-300 has-[:checked]:bg-sky-50">
      <input
        id={id}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="mt-0.5 size-5 shrink-0 accent-sky-600"
        {...props}
      />
      <div>
        <label htmlFor={id} className="font-semibold text-ink">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-sm text-ink-2">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/** Submit button that shows progress while its form's server action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  size = "md",
  icon,
  className,
  ...props
}: ComponentProps<"button"> & { pendingLabel?: string; variant?: ButtonVariant; size?: ButtonSize; icon?: IconName }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      icon={pending ? undefined : icon}
      disabled={pending || props.disabled}
      aria-disabled={pending}
      className={className}
      {...props}
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

const MESSAGE_STYLE = {
  success: { cls: "border-sage-100 bg-sage-100/70 text-sage-700", icon: "check" as const },
  warning: { cls: "border-amber-100 bg-amber-100/70 text-amber-700", icon: "alert" as const },
  error: { cls: "border-rose-100 bg-rose-100/60 text-rose-700", icon: "alert" as const },
};

/**
 * Announces the result of a server action: errors and warnings assertively, success
 * politely. After a failed submit, focus moves to the first invalid field so keyboard
 * and screen-reader users land exactly where the fix is needed.
 */
export function FormMessage({ state, className = "" }: { state: ActionState; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const invalid = ref.current?.closest("form")?.querySelector<HTMLElement>("[aria-invalid='true']");
    invalid?.focus();
  }, [state]);

  if (state.status === "idle" || !state.message) return <div ref={ref} aria-live="polite" className="sr-only" />;
  const style = MESSAGE_STYLE[state.status];
  return (
    <div
      ref={ref}
      role={state.status === "success" ? "status" : "alert"}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[0.95rem] ${style.cls} ${className}`}
    >
      <Icon name={style.icon} className="mt-0.5 size-5" />
      <span>{state.message}</span>
    </div>
  );
}

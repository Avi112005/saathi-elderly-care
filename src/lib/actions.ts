import type { FieldErrors } from "@/lib/validation/schemas";

/** The shape every form-backed server action returns to `useActionState`. */
export interface ActionState {
  /** `warning`: the action succeeded but needs attention (e.g. an out-of-range reading). */
  status: "idle" | "success" | "warning" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Small, non-sensitive values the UI needs after success (e.g. a one-time invite code). */
  data?: Record<string, string>;
}

export const IDLE: ActionState = { status: "idle" };

export const ok = (message?: string, data?: Record<string, string>): ActionState => ({
  status: "success",
  message,
  data,
});
export const warn = (message: string): ActionState => ({ status: "warning", message });
export const fail = (message: string, fieldErrors?: FieldErrors): ActionState => ({
  status: "error",
  message,
  fieldErrors,
});

import type { Role } from "./types";

/**
 * Access control for a care circle. The elder is always in charge of their own care:
 * they can do everything, and only they can approve medication changes proposed by
 * others when consent mode is on.
 */
export type Action =
  | "view"
  | "dose:log"
  | "medication:edit"
  | "appointment:edit"
  | "routine:edit"
  | "circle:manage"
  | "profile:edit"
  | "request:decide"
  | "consent:disable";

export interface Actor {
  role: Role;
  isAdmin: boolean;
}

const BASE: Record<Role, ReadonlySet<Action>> = {
  ELDER: new Set<Action>([
    "view",
    "dose:log",
    "medication:edit",
    "appointment:edit",
    "routine:edit",
    "circle:manage",
    "profile:edit",
    "request:decide",
    "consent:disable",
  ]),
  CARETAKER: new Set<Action>(["view", "dose:log", "medication:edit", "appointment:edit", "routine:edit"]),
  // Routines (walks, BP checks) carry little risk, so family can set them up too.
  FAMILY: new Set<Action>(["view", "dose:log", "appointment:edit", "routine:edit"]),
};

/** Extra powers for a circle admin (e.g. the son who set the profile up). */
const ADMIN_EXTRA: ReadonlySet<Action> = new Set<Action>(["medication:edit", "circle:manage", "profile:edit"]);

export function can(actor: Actor, action: Action): boolean {
  return BASE[actor.role].has(action) || (actor.isAdmin && ADMIN_EXTRA.has(action));
}

/**
 * Whether a medication change by this actor must wait for the elder's approval.
 * Consent only applies when the circle actually has an elder who can give it.
 */
export function requiresConsent(actor: Actor, consentMode: boolean, circleHasElder: boolean): boolean {
  return consentMode && circleHasElder && actor.role !== "ELDER";
}

/** Who may change another member's role or remove them. Nobody can remove the elder. */
export function canManageMember(actor: Actor, target: { role: Role; id: string }, actorId: string): boolean {
  if (!can(actor, "circle:manage")) return false;
  if (target.role === "ELDER") return false;
  return target.id !== actorId;
}

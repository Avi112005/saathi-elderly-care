/**
 * The escalation ladder for an unconfirmed dose. It is deliberately gentle: the elder
 * is always told first, and the wider circle only hears about it when a dose has
 * genuinely gone unconfirmed for a while.
 *
 *   lead before   → UPCOMING  : reminder to the elder (and caretakers who opted in)
 *   nudge after   → NUDGE     : "did you take it?" to the elder and caretakers
 *   escalate after→ ESCALATE  : dose marked missed, the whole circle is informed
 */
export type EscalationStage = "NONE" | "UPCOMING" | "NUDGE" | "ESCALATE";

export interface EscalationPolicy {
  leadMin: number;
  nudgeAfterMin: number;
  escalateAfterMin: number;
  /** Doses older than this are never acted on (prevents floods after downtime). */
  lookbackMin: number;
}

export const DEFAULT_POLICY: EscalationPolicy = {
  leadMin: 15,
  nudgeAfterMin: 30,
  escalateAfterMin: 120,
  lookbackMin: 24 * 60,
};

export function escalationStage(scheduledFor: Date, now: Date, policy: EscalationPolicy = DEFAULT_POLICY): EscalationStage {
  const minutesSince = (now.getTime() - scheduledFor.getTime()) / 60_000;
  if (minutesSince > policy.lookbackMin) return "NONE";
  if (minutesSince >= policy.escalateAfterMin) return "ESCALATE";
  if (minutesSince >= policy.nudgeAfterMin) return "NUDGE";
  if (minutesSince >= -policy.leadMin && minutesSince < 0) return "UPCOMING";
  return "NONE";
}

/** Validates a policy coming from user settings: the ladder must strictly climb. */
export function isValidPolicy(p: Pick<EscalationPolicy, "leadMin" | "nudgeAfterMin" | "escalateAfterMin">): boolean {
  return p.leadMin >= 0 && p.leadMin <= 120 && p.nudgeAfterMin >= 5 && p.escalateAfterMin > p.nudgeAfterMin && p.escalateAfterMin <= 720;
}

export type AppointmentStage = "NONE" | "DAY_BEFORE" | "SOON";

/** 24 hours before → DAY_BEFORE; 2 hours before → SOON. Past appointments → NONE. */
export function appointmentStage(startsAt: Date, now: Date): AppointmentStage {
  const minutesUntil = (startsAt.getTime() - now.getTime()) / 60_000;
  if (minutesUntil <= 0) return "NONE";
  if (minutesUntil <= 120) return "SOON";
  if (minutesUntil <= 24 * 60) return "DAY_BEFORE";
  return "NONE";
}

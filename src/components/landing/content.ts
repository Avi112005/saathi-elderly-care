import type { IconName } from "@/components/ui/icon";

/** Copy for the landing page, kept apart from its layout so it can be edited (or translated) on its own. */

interface Feature {
  icon: IconName;
  title: string;
  body: string;
}

export const STEPS: Feature[] = [
  {
    icon: "heart",
    title: "Centre",
    body: "One health profile for the elder — conditions, allergies, doctors — owned by them.",
  },
  {
    icon: "users",
    title: "Circle",
    body: "Invite a caretaker and family with one-time codes. Everyone gets their own PIN.",
  },
  {
    icon: "pill",
    title: "Schedule",
    body: "Add each medicine once: dose, times, days, food rules, what the pill looks like.",
  },
  {
    icon: "shield",
    title: "Check",
    body: "A senior safety check flags risky combinations, allergies and timing clashes.",
  },
  { icon: "bell", title: "Remind", body: "An email arrives a few minutes before every dose and appointment." },
  { icon: "check", title: "Confirm", body: "One big button: Taken. Or Skip, with a reason. Undo is always there." },
  { icon: "send", title: "Escalate", body: "Unconfirmed? Nudge at 30 min, tell the family at 2 h. Never a flood." },
  { icon: "chart", title: "Review", body: "Patterns and a printable health card to take to the doctor." },
];

export const LADDER = [
  {
    when: "15 min before",
    who: "Kamala",
    what: "“Time for your 8 PM medicines” — with the pill names and food instructions.",
    tone: "bg-sky-600",
  },
  {
    when: "+30 minutes",
    who: "Kamala & Priya",
    what: "“Did you take it?” A gentle nudge to her and her caretaker — no one else yet.",
    tone: "bg-marigold-400",
  },
  {
    when: "+2 hours",
    who: "The whole circle",
    what: "Marked missed. Rahul gets one clear email: what, when, and a reminder not to double the next dose.",
    tone: "bg-rose",
  },
];

export const TRUST: { value: string; label: string }[] = [
  { value: "0", label: "duplicate reminders — every email has an idempotency key" },
  { value: "5", label: "wrong PINs before a 15-minute pause, per person" },
  { value: "100%", label: "of changes written to a who-did-what activity log" },
  { value: "1", label: "person who approves medicine changes: the elder" },
];

export const HOOD: Feature[] = [
  {
    icon: "lock",
    title: "Passcode-based circles",
    body: "A public care code plus a personal PIN, hashed with scrypt. Invite codes are single-use, expire in 72 h and are stored only as hashes.",
  },
  {
    icon: "bell",
    title: "An escalation engine",
    body: "A minute-by-minute sweep, timezone-aware and DST-safe, with exactly-once delivery through a deduplicated outbox.",
  },
  {
    icon: "shield",
    title: "Senior safety check",
    body: "Curated drug interactions, Beers Criteria® cautions for 65+, allergy conflicts and dose-spacing rules — offline, explainable.",
  },
  {
    icon: "heart",
    title: "Consent mode",
    body: "Changes proposed by family wait for the elder's yes. Their care, their decision.",
  },
  {
    icon: "text",
    title: "Built for older eyes",
    body: "Large-text and high-contrast modes, read-aloud, 44px+ targets, full keyboard support and screen-reader labels.",
  },
  {
    icon: "sparkles",
    title: "Honest insights",
    body: "Rule-based patterns from real dose history — which time of day slips, which medicine is skipped — never guesses.",
  },
];

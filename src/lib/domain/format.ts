const COUNTABLE = /^(tablet|capsule|drop|puff|patch|injection|sachet|spoon|teaspoon|tablespoon|unit|pill)$/i;

/** 1 + "tablet" → "1 tablet"; 2 + "tablet" → "2 tablets"; 5 + "ml" → "5 ml". */
export function formatDose(quantity: number, unit: string): string {
  const plural = quantity !== 1 && COUNTABLE.test(unit) ? `${unit}s` : unit;
  return `${quantity} ${plural}`;
}

/** "Kamala Devi Sharma" → "KS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)![0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Hides most of an email address: "priya.sharma@gmail.com" → "pr•••@gmail.com". */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 2)}•••@${domain}`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

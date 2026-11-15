/** Minimal RFC 5545 calendar export for one appointment (works with Google, Apple and Outlook). */
import { MINUTE_MS } from "./time";

function stamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Escapes text values per RFC 5545 §3.3.11. */
export function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines longer than 75 octets, as the spec requires. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(
  a: { id: string; title: string; startsAt: Date; durationMin: number; location: string; description: string },
  now: Date = new Date(),
): string {
  const end = new Date(a.startsAt.getTime() + a.durationMin * MINUTE_MS);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Saathi Care//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@saathi.care`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(a.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${icsEscape(a.title)}`,
    ...(a.location ? [`LOCATION:${icsEscape(a.location)}`] : []),
    ...(a.description ? [`DESCRIPTION:${icsEscape(a.description)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(a.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

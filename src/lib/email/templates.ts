/**
 * Email templates. Pure functions (no I/O) so they are easy to unit-test. Every piece
 * of user-supplied text is HTML-escaped before it is placed in markup.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strips CR/LF so user text can never inject extra email headers via the subject. */
export function safeSubject(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 160);
}

type Tone = "info" | "warn" | "alert" | "good";

const TONE: Record<Tone, { bar: string; chip: string; chipText: string; label: string }> = {
  info: { bar: "#3b66ae", chip: "#dfeaf9", chipText: "#2f528c", label: "Reminder" },
  warn: { bar: "#c98f2e", chip: "#fbf0d9", chipText: "#8a5f14", label: "Needs attention" },
  alert: { bar: "#c96666", chip: "#f8e2e2", chipText: "#8f3b3b", label: "Missed" },
  good: { bar: "#5f9474", chip: "#e3f0e7", chipText: "#3d6b50", label: "Update" },
};

export interface EmailItem {
  title: string;
  detail?: string;
}

interface Layout {
  subject: string;
  preheader: string;
  tone: Tone;
  greeting: string;
  heading: string;
  intro: string;
  items?: EmailItem[];
  outro?: string;
  cta?: { label: string; url: string };
}

function layout(l: Layout): RenderedEmail {
  const t = TONE[l.tone];
  const items = (l.items ?? [])
    .map(
      (i) => `<tr><td style="padding:12px 16px;border-top:1px solid #e7e3d8;">
<div style="font:600 16px/1.4 Arial,Helvetica,sans-serif;color:#1e2942;">${escapeHtml(i.title)}</div>
${i.detail ? `<div style="font:14px/1.5 Arial,Helvetica,sans-serif;color:#4a5671;margin-top:2px;">${escapeHtml(i.detail)}</div>` : ""}
</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(l.subject)}</title></head>
<body style="margin:0;padding:0;background:#fbfaf6;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(l.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfaf6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e3d8;border-radius:14px;overflow:hidden;">
<tr><td style="height:6px;background:${t.bar};"></td></tr>
<tr><td style="padding:24px 24px 8px;">
<div style="font:italic 22px/1 Georgia,'Times New Roman',serif;color:#1e2942;">Saathi<span style="color:${t.bar};">.</span></div>
<div style="display:inline-block;margin-top:16px;padding:4px 10px;border-radius:999px;background:${t.chip};color:${t.chipText};font:600 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.04em;text-transform:uppercase;">${t.label}</div>
<p style="font:16px/1.5 Arial,Helvetica,sans-serif;color:#4a5671;margin:16px 0 4px;">${escapeHtml(l.greeting)}</p>
<h1 style="font:400 28px/1.2 Georgia,'Times New Roman',serif;color:#1e2942;margin:0 0 12px;">${escapeHtml(l.heading)}</h1>
<p style="font:16px/1.6 Arial,Helvetica,sans-serif;color:#1e2942;margin:0 0 16px;">${escapeHtml(l.intro)}</p>
</td></tr>
${items ? `<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e3d8;border-radius:12px;background:#fbfaf6;">${items}</table></td></tr>` : ""}
<tr><td style="padding:16px 24px 24px;">
${l.outro ? `<p style="font:15px/1.6 Arial,Helvetica,sans-serif;color:#4a5671;margin:0 0 16px;">${escapeHtml(l.outro)}</p>` : ""}
${l.cta ? `<a href="${escapeHtml(l.cta.url)}" style="display:inline-block;background:#3b66ae;color:#ffffff;text-decoration:none;font:600 16px/1 Arial,Helvetica,sans-serif;padding:14px 22px;border-radius:12px;">${escapeHtml(l.cta.label)}</a>` : ""}
</td></tr>
</table>
<p style="font:12px/1.6 Arial,Helvetica,sans-serif;color:#8691a7;max-width:560px;margin:16px auto 0;">You receive this because you are part of a Saathi care circle. Change which emails you get under Settings → Notifications. Saathi is a reminder tool, not medical advice — in an emergency call your local emergency number.</p>
</td></tr></table></body></html>`;

  const text = [
    l.greeting,
    "",
    l.heading,
    "",
    l.intro,
    ...(l.items?.length ? ["", ...l.items.map((i) => `• ${i.title}${i.detail ? ` — ${i.detail}` : ""}`)] : []),
    ...(l.outro ? ["", l.outro] : []),
    ...(l.cta ? ["", `${l.cta.label}: ${l.cta.url}`] : []),
    "",
    "— Saathi care circle",
    "Saathi is a reminder tool, not medical advice. In an emergency call your local emergency number.",
  ].join("\n");

  return { subject: safeSubject(l.subject), text, html };
}

export interface DoseLine {
  name: string;
  dose: string;
  instructions?: string;
}

const doseItems = (doses: DoseLine[]): EmailItem[] =>
  doses.map((d) => ({ title: d.name, detail: [d.dose, d.instructions].filter(Boolean).join(" · ") }));

interface Who {
  recipientName: string;
  elderName: string;
  /** True when the email goes to the elder themself. */
  toElder: boolean;
  appUrl: string;
}

export function doseUpcomingEmail(w: Who & { time: string; doses: DoseLine[] }): RenderedEmail {
  const count = w.doses.length === 1 ? "1 medicine" : `${w.doses.length} medicines`;
  return layout({
    tone: "info",
    subject: w.toElder ? `Time for your ${w.time} medicines` : `${w.elderName}'s ${w.time} medicines are coming up`,
    preheader: `${count} at ${w.time}`,
    greeting: `Hello ${w.recipientName},`,
    heading: w.toElder ? `Your ${w.time} medicines` : `${w.elderName}'s ${w.time} dose`,
    intro: w.toElder
      ? `In a few minutes it will be time to take ${count}. Tap "Taken" in Saathi afterwards so your family knows you're on track.`
      : `${w.elderName} has ${count} due at ${w.time}.`,
    items: doseItems(w.doses),
    cta: { label: "Open today's medicines", url: `${w.appUrl}/app` },
  });
}

export function doseNudgeEmail(w: Who & { time: string; doses: DoseLine[]; minutesLate: number }): RenderedEmail {
  return layout({
    tone: "warn",
    subject: w.toElder
      ? `Did you take your ${w.time} medicines?`
      : `${w.elderName}'s ${w.time} dose isn't confirmed yet`,
    preheader: `Not confirmed ${w.minutesLate} minutes after it was due`,
    greeting: `Hello ${w.recipientName},`,
    heading: w.toElder ? "Just checking in" : `${w.elderName}'s ${w.time} dose isn't confirmed`,
    intro: w.toElder
      ? `Your ${w.time} medicines haven't been marked as taken yet. If you've taken them, tap "Taken" so nobody worries. If not, it's usually fine to take them now — check the label if unsure.`
      : `It's been ${w.minutesLate} minutes and these haven't been marked as taken. A gentle call or message usually sorts it out.`,
    items: doseItems(w.doses),
    cta: { label: "Confirm in Saathi", url: `${w.appUrl}/app` },
  });
}

export function doseMissedEmail(w: Who & { time: string; doses: DoseLine[] }): RenderedEmail {
  return layout({
    tone: "alert",
    subject: `Missed: ${w.toElder ? "your" : `${w.elderName}'s`} ${w.time} medicines`,
    preheader: "Marked missed — the care circle has been told",
    greeting: `Hello ${w.recipientName},`,
    heading: w.toElder ? `Your ${w.time} medicines were missed` : `${w.elderName} missed the ${w.time} dose`,
    intro: w.toElder
      ? "These weren't confirmed, so Saathi marked them as missed and let your care circle know. Don't double up on the next dose unless your doctor has told you to."
      : `These weren't confirmed within the escalation window, so they've been marked as missed. Please check in with ${w.elderName}. Don't let them double the next dose unless their doctor advised it.`,
    items: doseItems(w.doses),
    outro: "If the dose was actually taken, open Saathi and mark it as taken — the record will be corrected.",
    cta: { label: "Review in Saathi", url: `${w.appUrl}/app` },
  });
}

export function appointmentEmail(
  w: Who & {
    stage: "DAY_BEFORE" | "SOON";
    title: string;
    when: string;
    doctor: string;
    location: string;
    questions: string[];
    transport: string;
  },
): RenderedEmail {
  const items: EmailItem[] = [
    { title: w.when, detail: [w.doctor, w.location].filter(Boolean).join(" · ") },
    ...(w.transport ? [{ title: "Getting there", detail: w.transport }] : []),
    ...w.questions.slice(0, 6).map((q) => ({ title: `Ask: ${q}` })),
  ];
  return layout({
    tone: "info",
    subject: `${w.stage === "SOON" ? "In 2 hours" : "Tomorrow"}: ${w.toElder ? "your" : `${w.elderName}'s`} ${w.title}`,
    preheader: `${w.title} — ${w.when}`,
    greeting: `Hello ${w.recipientName},`,
    heading: w.stage === "SOON" ? `${w.title} is in about 2 hours` : `${w.title} is tomorrow`,
    intro:
      w.stage === "SOON"
        ? "Time to get ready. Take the medicine list (or the Saathi health card) and any reports along."
        : "A heads-up so there's time to arrange travel and gather reports. The questions noted for the doctor are below.",
    items,
    cta: { label: "See appointment", url: `${w.appUrl}/app/appointments` },
  });
}

export function refillEmail(w: Who & { medicine: string; daysLeft: number; runsOutOn: string }): RenderedEmail {
  return layout({
    tone: "warn",
    subject: `Refill soon: ${w.medicine} (${w.daysLeft} day${w.daysLeft === 1 ? "" : "s"} left)`,
    preheader: `Runs out around ${w.runsOutOn}`,
    greeting: `Hello ${w.recipientName},`,
    heading: `${w.medicine} is running low`,
    intro: `At the current schedule, ${w.toElder ? "your" : `${w.elderName}'s`} supply lasts about ${w.daysLeft} more day${w.daysLeft === 1 ? "" : "s"} (until around ${w.runsOutOn}). Order a refill now so no dose is missed.`,
    outro: "After the refill arrives, update the stock count in Saathi to keep the forecast accurate.",
    cta: { label: "Update stock", url: `${w.appUrl}/app/medications` },
  });
}

export function dailyDigestEmail(
  w: Who & {
    date: string;
    taken: number;
    due: number;
    missed: string[];
    upcoming: string[];
    lowStock: string[];
    readings?: string[];
  },
): RenderedEmail {
  const rate = w.due === 0 ? null : Math.round((w.taken / w.due) * 100);
  const items: EmailItem[] = [
    { title: `${w.taken} of ${w.due} doses taken${rate === null ? "" : ` (${rate}%)`}` },
    ...w.missed.map((m) => ({ title: `Missed: ${m}` })),
    ...w.upcoming.map((u) => ({ title: `Coming up: ${u}` })),
    ...w.lowStock.map((s) => ({ title: `Low stock: ${s}` })),
    ...(w.readings ?? []).map((r) => ({ title: `Reading: ${r}` })),
  ];
  return layout({
    tone: w.missed.length ? "warn" : "good",
    subject: `${w.elderName}'s day — ${w.taken}/${w.due} doses taken`,
    preheader: w.missed.length ? `${w.missed.length} missed today` : "All on track today",
    greeting: `Hello ${w.recipientName},`,
    heading: `${w.elderName}'s day, ${w.date}`,
    intro: w.missed.length
      ? "A quick summary — a couple of things may need a check-in."
      : "A quick summary — everything is on track.",
    items,
    cta: { label: "Open Saathi", url: `${w.appUrl}/app` },
  });
}

export function vitalAlertEmail(
  w: Who & {
    check: string;
    reading: string;
    flag: "LOW" | "HIGH" | "URGENT";
    advice: string;
    loggedBy: string;
    when: string;
  },
): RenderedEmail {
  const word = w.flag === "URGENT" ? "Urgent" : w.flag === "HIGH" ? "High" : "Low";
  return layout({
    tone: w.flag === "URGENT" ? "alert" : "warn",
    subject: `${word} reading: ${w.toElder ? "your" : `${w.elderName}'s`} ${w.check.toLowerCase()} ${w.reading}`,
    preheader: w.advice,
    greeting: `Hello ${w.recipientName},`,
    heading: `${w.toElder ? "Your" : `${w.elderName}'s`} ${w.check.toLowerCase()}: ${w.reading}`,
    intro: `${w.advice}${w.flag === "URGENT" ? " If there is chest pain, confusion, breathlessness or fainting, call your local emergency number." : ""}`,
    items: [{ title: w.reading, detail: `Recorded by ${w.loggedBy} · ${w.when}` }],
    outro: "This is general guidance, not a diagnosis. The doctor's own targets for this person take priority.",
    cta: { label: "See readings", url: `${w.appUrl}/app/insights#vitals` },
  });
}

export function routineUpcomingEmail(w: Who & { time: string; routines: string[] }): RenderedEmail {
  return layout({
    tone: "info",
    subject: w.toElder ? `${w.time}: ${w.routines.join(", ")}` : `${w.elderName}'s ${w.time} routine`,
    preheader: w.routines.join(", "),
    greeting: `Hello ${w.recipientName},`,
    heading: w.toElder ? `Time for your ${w.time} routine` : `${w.elderName}'s ${w.time} routine`,
    intro: w.toElder
      ? "A gentle reminder. Record it in Saathi when it's done — for checks, type in the reading."
      : `${w.elderName} has this routine coming up.`,
    items: w.routines.map((r) => ({ title: r })),
    cta: { label: "Open today", url: `${w.appUrl}/app` },
  });
}

export function changeRequestEmail(w: Who & { requester: string; summary: string }): RenderedEmail {
  return layout({
    tone: "info",
    subject: `${w.requester} suggested a change to your medicines`,
    preheader: w.summary,
    greeting: `Hello ${w.recipientName},`,
    heading: "A change is waiting for your OK",
    intro: `${w.requester} suggested: ${w.summary}. Nothing changes until you approve it.`,
    cta: { label: "Review the change", url: `${w.appUrl}/app/circle#requests` },
  });
}

export function testEmail(w: { recipientName: string; appUrl: string }): RenderedEmail {
  return layout({
    tone: "good",
    subject: "Saathi test email — delivery works",
    preheader: "Your reminders will arrive like this",
    greeting: `Hello ${w.recipientName},`,
    heading: "Email delivery is working",
    intro:
      "This is how Saathi reminders will look in your inbox. If it landed in spam, mark it as 'not spam' so real reminders are never missed.",
    cta: { label: "Open Saathi", url: `${w.appUrl}/app` },
  });
}

import { describe, expect, it } from "vitest";
import {
  appointmentEmail,
  dailyDigestEmail,
  doseMissedEmail,
  doseUpcomingEmail,
  escapeHtml,
  safeSubject,
} from "@/lib/email/templates";
import { clockToMinutes, dayPartOf, formatClock, isWithinQuietHours, localDayBounds } from "@/lib/domain/time";
import { buildIcs, icsEscape } from "@/lib/domain/ics";
import { formatDose, initials, maskEmail } from "@/lib/domain/format";

const who = { recipientName: "Rahul", elderName: "Kamala", toElder: false, appUrl: "https://saathi.example" };

describe("email templates", () => {
  it("escapes user-provided text in HTML", () => {
    const email = doseUpcomingEmail({
      ...who,
      elderName: "<img src=x onerror=alert(1)>",
      time: "8:00 AM",
      doses: [{ name: "<b>Evil</b>", dose: "1 tablet" }],
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<b>Evil</b>");
    expect(email.html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
  });

  it("prevents header injection through subjects", () => {
    expect(safeSubject("Hello\r\nBcc: attacker@example.com")).toBe("Hello Bcc: attacker@example.com");
    const email = doseMissedEmail({ ...who, elderName: "Kamala\nBcc: x@y.z", time: "9:00 PM", doses: [] });
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it("speaks to the elder directly and about them to others", () => {
    const toElder = doseUpcomingEmail({
      ...who,
      toElder: true,
      recipientName: "Kamala",
      time: "8:00 AM",
      doses: [{ name: "Metformin 500 mg", dose: "1 tablet" }],
    });
    expect(toElder.subject).toBe("Time for your 8:00 AM medicines");
    const toFamily = doseUpcomingEmail({
      ...who,
      time: "8:00 AM",
      doses: [{ name: "Metformin 500 mg", dose: "1 tablet" }],
    });
    expect(toFamily.subject).toBe("Kamala's 8:00 AM medicines are coming up");
    expect(toFamily.text).toContain("• Metformin 500 mg — 1 tablet");
    expect(toFamily.text).toContain("https://saathi.example/app");
  });

  it("includes doctor questions and transport in appointment reminders", () => {
    const email = appointmentEmail({
      ...who,
      stage: "DAY_BEFORE",
      title: "Cardiology",
      when: "Sat 11:00",
      doctor: "Dr. Mehta",
      location: "Sunrise",
      questions: ["Reduce the sleeping tablet?"],
      transport: "Rahul drives",
    });
    expect(email.subject).toBe("Tomorrow: Kamala's Cardiology");
    expect(email.text).toContain("Ask: Reduce the sleeping tablet?");
    expect(email.text).toContain("Rahul drives");
  });

  it("summarises the day in the digest", () => {
    const email = dailyDigestEmail({
      ...who,
      date: "10 March",
      taken: 5,
      due: 6,
      missed: ["Atorvastatin at 9:00 PM"],
      upcoming: [],
      lowStock: [],
    });
    expect(email.subject).toBe("Kamala's day — 5/6 doses taken");
    expect(email.text).toContain("(83%)");
  });

  it("escapes all five HTML special characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });
});

describe("time helpers", () => {
  it("formats 24h clock times for older readers", () => {
    expect(formatClock("00:05")).toBe("12:05 AM");
    expect(formatClock("12:00")).toBe("12:00 PM");
    expect(formatClock("21:30")).toBe("9:30 PM");
    expect(() => clockToMinutes("7pm")).toThrow();
  });

  it("buckets times into parts of the day", () => {
    expect(["06:30", "08:00", "13:30", "20:00", "22:00"].map(dayPartOf)).toEqual([
      "Early morning",
      "Morning",
      "Afternoon",
      "Evening",
      "Night",
    ]);
  });

  it("handles quiet hours that wrap past midnight", () => {
    expect(isWithinQuietHours("23:00", "22:00", "07:00")).toBe(true);
    expect(isWithinQuietHours("06:59", "22:00", "07:00")).toBe(true);
    expect(isWithinQuietHours("07:00", "22:00", "07:00")).toBe(false);
    expect(isWithinQuietHours("14:00", "13:00", "15:00")).toBe(true);
    expect(isWithinQuietHours("14:00", null, null)).toBe(false);
    expect(isWithinQuietHours("14:00", "10:00", "10:00")).toBe(false);
  });

  it("finds the local day in the elder's zone", () => {
    const { start, end } = localDayBounds(new Date("2026-03-10T20:00:00.000Z"), "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-03-10T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-03-11T18:30:00.000Z");
  });
});

describe("formatting", () => {
  it("pluralises countable units only", () => {
    expect(formatDose(1, "tablet")).toBe("1 tablet");
    expect(formatDose(2, "tablet")).toBe("2 tablets");
    expect(formatDose(0.5, "tablet")).toBe("0.5 tablets");
    expect(formatDose(5, "ml")).toBe("5 ml");
  });
  it("masks emails and makes initials", () => {
    expect(maskEmail("priya.sharma@gmail.com")).toBe("pr•••@gmail.com");
    expect(initials("Kamala Devi Sharma")).toBe("KS");
    expect(initials("  ")).toBe("?");
  });
});

describe("calendar export", () => {
  it("builds a valid, escaped VEVENT with a 2-hour alarm", () => {
    const ics = buildIcs(
      {
        id: "a1",
        title: "Cardiology, follow-up; Dr. M",
        startsAt: new Date("2026-03-10T05:30:00.000Z"),
        durationMin: 30,
        location: "MG Road",
        description: "Line 1\nLine 2",
      },
      new Date("2026-03-01T00:00:00.000Z"),
    );
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260310T053000Z");
    expect(ics).toContain("DTEND:20260310T060000Z");
    expect(ics).toContain("SUMMARY:Cardiology\\, follow-up\\; Dr. M");
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(icsEscape("a\\b")).toBe("a\\\\b");
  });
});

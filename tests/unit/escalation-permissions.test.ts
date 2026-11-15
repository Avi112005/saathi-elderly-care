import { describe, expect, it } from "vitest";
import { appointmentStage, DEFAULT_POLICY, escalationStage, isValidPolicy } from "@/lib/domain/escalation";
import { can, canManageMember, requiresConsent, type Actor } from "@/lib/domain/permissions";

const dose = new Date("2026-03-10T08:00:00.000Z");
const plus = (min: number) => new Date(dose.getTime() + min * 60_000);

describe("escalationStage", () => {
  it.each([
    [-60, "NONE"],
    [-15, "UPCOMING"],
    [-1, "UPCOMING"],
    [0, "NONE"],
    [29, "NONE"],
    [30, "NUDGE"],
    [119, "NUDGE"],
    [120, "ESCALATE"],
    [24 * 60, "ESCALATE"],
    [24 * 60 + 1, "NONE"],
  ])("%i minutes from the dose → %s", (minutes, stage) => {
    expect(escalationStage(dose, plus(minutes), DEFAULT_POLICY)).toBe(stage);
  });

  it("follows a custom policy", () => {
    const policy = { ...DEFAULT_POLICY, leadMin: 5, nudgeAfterMin: 10, escalateAfterMin: 20 };
    expect(escalationStage(dose, plus(-6), policy)).toBe("NONE");
    expect(escalationStage(dose, plus(10), policy)).toBe("NUDGE");
    expect(escalationStage(dose, plus(20), policy)).toBe("ESCALATE");
  });
});

describe("isValidPolicy", () => {
  it("requires the ladder to climb", () => {
    expect(isValidPolicy({ leadMin: 15, nudgeAfterMin: 30, escalateAfterMin: 120 })).toBe(true);
    expect(isValidPolicy({ leadMin: 15, nudgeAfterMin: 60, escalateAfterMin: 60 })).toBe(false);
    expect(isValidPolicy({ leadMin: -1, nudgeAfterMin: 30, escalateAfterMin: 120 })).toBe(false);
    expect(isValidPolicy({ leadMin: 15, nudgeAfterMin: 2, escalateAfterMin: 120 })).toBe(false);
    expect(isValidPolicy({ leadMin: 15, nudgeAfterMin: 30, escalateAfterMin: 1000 })).toBe(false);
  });
});

describe("appointmentStage", () => {
  const start = new Date("2026-03-10T10:00:00.000Z");
  const before = (h: number) => new Date(start.getTime() - h * 3_600_000);
  it("sends the day-before and two-hour reminders", () => {
    expect(appointmentStage(start, before(30))).toBe("NONE");
    expect(appointmentStage(start, before(24))).toBe("DAY_BEFORE");
    expect(appointmentStage(start, before(3))).toBe("DAY_BEFORE");
    expect(appointmentStage(start, before(2))).toBe("SOON");
    expect(appointmentStage(start, before(0))).toBe("NONE");
  });
});

describe("permissions", () => {
  const elder: Actor = { role: "ELDER", isAdmin: true };
  const caretaker: Actor = { role: "CARETAKER", isAdmin: false };
  const family: Actor = { role: "FAMILY", isAdmin: false };
  const familyAdmin: Actor = { role: "FAMILY", isAdmin: true };

  it("lets the elder do everything", () => {
    for (const a of [
      "view",
      "dose:log",
      "medication:edit",
      "appointment:edit",
      "circle:manage",
      "profile:edit",
      "request:decide",
      "consent:disable",
    ] as const) {
      expect(can(elder, a)).toBe(true);
    }
  });

  it("lets caretakers manage medicines but not the circle", () => {
    expect(can(caretaker, "medication:edit")).toBe(true);
    expect(can(caretaker, "circle:manage")).toBe(false);
    expect(can(caretaker, "request:decide")).toBe(false);
  });

  it("limits family to logging and appointments unless they are an admin", () => {
    expect(can(family, "dose:log")).toBe(true);
    expect(can(family, "medication:edit")).toBe(false);
    expect(can(familyAdmin, "medication:edit")).toBe(true);
    expect(can(familyAdmin, "circle:manage")).toBe(true);
  });

  it("never lets anyone but the elder approve changes or switch consent off", () => {
    expect(can(familyAdmin, "request:decide")).toBe(false);
    expect(can(familyAdmin, "consent:disable")).toBe(false);
  });

  it("applies consent only to non-elders, and only when an elder can give it", () => {
    expect(requiresConsent(caretaker, true, true)).toBe(true);
    expect(requiresConsent(elder, true, true)).toBe(false);
    expect(requiresConsent(caretaker, false, true)).toBe(false);
    expect(requiresConsent(caretaker, true, false)).toBe(false);
  });

  it("protects the elder and yourself from removal", () => {
    expect(canManageMember(familyAdmin, { id: "e", role: "ELDER" }, "me")).toBe(false);
    expect(canManageMember(familyAdmin, { id: "me", role: "FAMILY" }, "me")).toBe(false);
    expect(canManageMember(familyAdmin, { id: "c", role: "CARETAKER" }, "me")).toBe(true);
    expect(canManageMember(caretaker, { id: "f", role: "FAMILY" }, "me")).toBe(false);
  });
});

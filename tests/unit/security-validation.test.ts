import { describe, expect, it } from "vitest";
import { CARE_CODE_PATTERN, formatCareCode, formatInviteCode, generateCareCode, generateInviteCode, generateToken, hashPasscode, sha256, verifyPasscode } from "@/lib/server/crypto";
import { RateLimiter } from "@/lib/server/rate-limit";
import { careCodeSchema, createCircleSchema, fieldErrors, formToObject, joinSchema, medicationSchema, memberSettingsSchema, pinWeakness, profileSchema } from "@/lib/validation/schemas";
import { buildCsp } from "@/proxy";
import { parseA11y, serializeA11y } from "@/lib/a11y";
import { TEST_PIN, TEST_PIN_2, TEST_PIN_3, TEST_PIN_8_DIGITS } from "../fixtures";

describe("passcode hashing", () => {
  it("verifies the right PIN and rejects the wrong one", async () => {
    const hash = await hashPasscode(TEST_PIN);
    expect(hash).toMatch(/^scrypt\$\d+\$8\$1\$/);
    expect(hash).not.toContain(TEST_PIN);
    expect(await verifyPasscode(TEST_PIN, hash)).toBe(true);
    expect(await verifyPasscode(`${TEST_PIN.slice(0, 5)}9`, hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPasscode(TEST_PIN)).not.toBe(await hashPasscode(TEST_PIN));
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPasscode(TEST_PIN, "plain-text")).toBe(false);
  });
});

describe("codes and tokens", () => {
  it("generates readable care codes without look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCareCode();
      expect(code).toMatch(CARE_CODE_PATTERN);
      expect(code).not.toMatch(/[01ILO]/);
    }
  });

  it("generates invite codes and unguessable session tokens", () => {
    expect(generateInviteCode()).toMatch(/^JOIN-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const tokens = new Set(Array.from({ length: 100 }, generateToken));
    expect(tokens.size).toBe(100);
    expect([...tokens][0]!.length).toBeGreaterThanOrEqual(43);
    expect(sha256("x")).toHaveLength(64);
  });

  it("normalises codes typed by people", () => {
    expect(formatCareCode(" k7qm4xpa ")).toBe("K7QM-4XPA");
    expect(formatInviteCode("join 8kd2 qf7m 4xpa")).toBe("JOIN-8KD2-QF7M-4XPA");
    expect(careCodeSchema.parse("care 2468")).toBe("CARE-2468");
    expect(careCodeSchema.safeParse("CARE-1234").success).toBe(false); // 1 is never used
  });
});

describe("PIN policy", () => {
  it.each(["123456", "654321", "111111", "000000", "121212", "12345", "abcdef", "123456789"])("rejects %s", (pin) => {
    expect(pinWeakness(pin)).not.toBeNull();
  });
  it.each([TEST_PIN, TEST_PIN_3, TEST_PIN_8_DIGITS])("accepts %s", (pin) => {
    expect(pinWeakness(pin)).toBeNull();
  });
});

describe("RateLimiter", () => {
  it("blocks after the limit and resets after the window", () => {
    const rl = new RateLimiter(3, 1000);
    expect([1, 2, 3].map(() => rl.check("ip", 0).allowed)).toEqual([true, true, true]);
    const blocked = rl.check("ip", 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(rl.check("other", 10).allowed).toBe(true);
    expect(rl.check("ip", 1001).allowed).toBe(true);
  });
});

describe("Content-Security-Policy", () => {
  it("is nonce-based and locks down framing and plugins in production", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("validation schemas", () => {
  const form = (entries: [string, string][]) => {
    const fd = new FormData();
    for (const [k, v] of entries) fd.append(k, v);
    return fd;
  };

  it("collects repeated form fields as arrays", () => {
    const obj = formToObject(form([["times", "08:00"], ["times", "20:00"], ["name", "x"], ["$ACTION_ID_1", "y"]]), ["times", "daysOfWeek"]);
    expect(obj).toEqual({ times: ["08:00", "20:00"], name: "x", daysOfWeek: [] });
  });

  const validMed = {
    name: "Metformin",
    strength: "500 mg",
    form: "TABLET",
    doseQuantity: "1",
    doseUnit: "tablet",
    times: ["08:00", "20:00"],
    daysOfWeek: ["1", "2", "3", "4", "5", "6", "7"],
    startDate: "2026-03-01",
    endDate: "",
    foodTiming: "WITH_FOOD",
    instructions: "",
    purpose: "Diabetes",
    prescriber: "",
    appearance: "",
    pillColor: "white",
    stockCount: "60",
    refillAt: "7",
  };

  it("accepts a valid medicine and coerces numbers", () => {
    const r = medicationSchema.parse(validMed);
    expect(r).toMatchObject({ doseQuantity: 1, stockCount: 60, endDate: null, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] });
  });

  it("rejects bad medicine input with field-level messages", () => {
    const r = medicationSchema.safeParse({ ...validMed, name: " ", times: ["25:00"], pillColor: "neon", form: "<script>" });
    expect(r.success).toBe(false);
    const errors = fieldErrors(r.error!);
    expect(Object.keys(errors).sort()).toEqual(["form", "name", "pillColor", "times"]);
  });

  it("rejects an end date before the start date", () => {
    const r = medicationSchema.safeParse({ ...validMed, endDate: "2026-02-01" });
    expect(fieldErrors(r.error!)).toHaveProperty("endDate");
  });

  it("rejects duplicate dose times", () => {
    expect(medicationSchema.safeParse({ ...validMed, times: ["08:00", "08:00"] }).success).toBe(false);
  });

  it("requires matching, strong PINs when creating a circle", () => {
    const base = { setupFor: "SELF", elderFullName: "Kamala Sharma", elderPreferredName: "Kamala", dateOfBirth: "", timezone: "Asia/Kolkata", conditions: "", allergies: "", yourName: "", relationship: "", email: "", consentMode: "on" };
    expect(createCircleSchema.safeParse({ ...base, pin: TEST_PIN, confirmPin: TEST_PIN }).success).toBe(true);
    expect(fieldErrors(createCircleSchema.safeParse({ ...base, pin: TEST_PIN, confirmPin: `${TEST_PIN.slice(0, 5)}9` }).error!)).toHaveProperty("confirmPin");
    expect(fieldErrors(createCircleSchema.safeParse({ ...base, pin: "123456", confirmPin: "123456" }).error!)).toHaveProperty("pin");
    expect(createCircleSchema.safeParse({ ...base, timezone: "Mars/Olympus", pin: TEST_PIN, confirmPin: TEST_PIN }).success).toBe(false);
  });

  it("accepts the 'for myself' form, which has no 'your name' or 'relationship' fields (regression)", () => {
    const selfForm = { setupFor: "SELF", elderFullName: "Meera Iyer", elderPreferredName: "Meera", dateOfBirth: "", timezone: "UTC", conditions: "", allergies: "", email: "", pin: TEST_PIN, confirmPin: TEST_PIN };
    expect(createCircleSchema.parse(selfForm)).toMatchObject({ yourName: "", relationship: "", consentMode: false });
  });

  it("requires a relative's name and a distinct elder PIN when setting up for someone else", () => {
    const base = { setupFor: "LOVED_ONE", elderFullName: "Kamala Sharma", elderPreferredName: "Kamala", dateOfBirth: "", timezone: "UTC", conditions: "", allergies: "", relationship: "Son", email: "rahul@example.com", pin: TEST_PIN_2, confirmPin: TEST_PIN_2 };
    expect(fieldErrors(createCircleSchema.safeParse({ ...base, yourName: "" }).error!)).toHaveProperty("yourName");
    expect(fieldErrors(createCircleSchema.safeParse({ ...base, yourName: "Rahul", elderPin: TEST_PIN_2 }).error!)).toHaveProperty("elderPin");
    expect(createCircleSchema.safeParse({ ...base, yourName: "Rahul", elderPin: TEST_PIN }).success).toBe(true);
  });

  it("normalises invite codes on join", () => {
    const r = joinSchema.parse({ inviteCode: "join-8kd2-qf7m-4xpa", name: "Anita", relationship: "", email: "", pin: TEST_PIN, confirmPin: TEST_PIN });
    expect(r.inviteCode).toBe("JOIN-8KD2-QF7M-4XPA");
  });

  it("needs both ends of quiet hours", () => {
    const base = { name: "Priya", relationship: "", email: "PRIYA@Example.com", quietStart: "22:00", quietEnd: "" };
    expect(memberSettingsSchema.safeParse(base).success).toBe(false);
    const ok = memberSettingsSchema.parse({ ...base, quietEnd: "07:00", emailDoseReminders: "on" });
    expect(ok.email).toBe("priya@example.com");
    expect(ok.emailDoseReminders).toBe(true);
    expect(ok.emailDailyDigest).toBe(false);
  });

  it("enforces a climbing escalation ladder and valid blood groups", () => {
    const base = { fullName: "K", preferredName: "K", dateOfBirth: "", timezone: "UTC", conditions: "", allergies: "", emergencyContact: "", primaryDoctor: "", notes: "", reminderLeadMin: "15", nudgeAfterMin: "30", escalateAfterMin: "120" };
    expect(profileSchema.safeParse({ ...base, bloodGroup: "O+" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, bloodGroup: "Z+" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, bloodGroup: "", escalateAfterMin: "20" }).success).toBe(false);
  });
});

describe("display preferences cookie", () => {
  it("round-trips and ignores tampered values", () => {
    expect(parseA11y(serializeA11y({ textSize: "xl", contrast: "high" }))).toEqual({ textSize: "xl", contrast: "high" });
    expect(parseA11y("huge.<script>")).toEqual({ textSize: "md", contrast: "normal" });
    expect(parseA11y(undefined)).toEqual({ textSize: "md", contrast: "normal" });
  });
});

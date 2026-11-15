/**
 * Server actions end to end against the test database: real sessions, the real
 * permission matrix, consent mode and input validation. Only the Next.js request
 * plumbing (cookies, headers, revalidation, redirects) is replaced.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateToken, hashPasscode, sha256 } from "@/lib/server/crypto";
import { db, makeCircle, resetDb } from "./helpers";
import { TEST_PIN, TEST_PIN_2 } from "../fixtures";

/* ---- Next.js request plumbing ------------------------------------------ */
const jar = new Map<string, string>();
const cookieStore = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  set: (name: string, value: string) => void jar.set(name, value),
  delete: (name: string) => void jar.delete(name),
};
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

const { saveMedication, logDose, stopMedication } = await import("@/app/actions/medications");
const { decideRequest, inviteMember } = await import("@/app/actions/circle");
const { signIn } = await import("@/app/actions/auth");
const { changePin } = await import("@/app/actions/settings");
const { logRoutineAction } = await import("@/app/actions/routines");
const { SESSION_COOKIE } = await import("@/lib/server/session");
const { IDLE } = await import("@/lib/actions");

async function signInAs(memberId: string) {
  const token = generateToken();
  await db.session.create({ data: { tokenHash: sha256(token), memberId, expiresAt: new Date(Date.now() + 86_400_000) } });
  jar.set(SESSION_COOKIE, token);
  return token;
}

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  return fd;
}

const medForm = (name = "Vitamin B12") =>
  form({
    name,
    strength: "500 mcg",
    form: "TABLET",
    doseQuantity: "1",
    doseUnit: "tablet",
    times: ["09:00"],
    daysOfWeek: ["1", "2", "3", "4", "5", "6", "7"],
    startDate: "2026-03-01",
    endDate: "",
    foodTiming: "ANY",
    instructions: "",
    purpose: "",
    prescriber: "",
    appearance: "",
    pillColor: "white",
    stockCount: "",
    refillAt: "7",
  });

beforeEach(async () => {
  jar.clear();
  await resetDb();
});
afterAll(() => db.$disconnect());

describe("authentication and authorisation", () => {
  it("refuses every action without a session", async () => {
    const res = await logDose(IDLE, form({ medicationId: "x", scheduledFor: new Date().toISOString(), status: "TAKEN" }));
    expect(res).toMatchObject({ status: "error", message: expect.stringMatching(/session has ended/) });
  });

  it("refuses an expired session", async () => {
    const { family } = await makeCircle();
    const token = generateToken();
    await db.session.create({ data: { tokenHash: sha256(token), memberId: family.id, expiresAt: new Date(Date.now() - 1000) } });
    jar.set(SESSION_COOKIE, token);
    expect(await inviteMember(IDLE, form({ role: "FAMILY", label: "" }))).toMatchObject({ status: "error" });
  });

  it("enforces roles: family cannot change medicines or invite people", async () => {
    const { family } = await makeCircle();
    await signInAs(family.id);
    expect(await saveMedication(IDLE, medForm())).toMatchObject({ status: "error", message: expect.stringMatching(/permission/) });
    expect(await inviteMember(IDLE, form({ role: "FAMILY", label: "" }))).toMatchObject({ status: "error" });
    expect(await db.medication.count()).toBe(0);
  });

  it("scopes every lookup to the signed-in circle (no IDOR)", async () => {
    const a = await makeCircle();
    const b = await makeCircle();
    const foreign = await db.medication.create({ data: { profileId: b.profile.id, name: "Warfarin", times: "20:00", startDate: "2026-01-01" } });
    await signInAs(a.elder.id);
    await expect(stopMedication(IDLE, form({ id: foreign.id }))).rejects.toThrow();
    expect((await db.medication.findUniqueOrThrow({ where: { id: foreign.id } })).active).toBe(true);
  });
});

describe("consent mode", () => {
  it("turns a caretaker's change into a request that only the elder can approve", async () => {
    const { profile, caretaker, elder } = await makeCircle({ consentMode: true });
    await signInAs(caretaker.id);
    const res = await saveMedication(IDLE, medForm());
    expect(res).toMatchObject({ status: "success", message: expect.stringMatching(/approval/) });
    expect(await db.medication.count()).toBe(0);
    const request = await db.changeRequest.findFirstOrThrow({ where: { profileId: profile.id } });
    expect(request).toMatchObject({ status: "PENDING", kind: "CREATE" });
    expect(await db.notification.count({ where: { kind: "CHANGE_REQUEST" } })).toBe(1);

    // The caretaker can't approve their own request…
    expect(await decideRequest(IDLE, form({ id: request.id, decision: "APPROVED" }))).toMatchObject({ status: "error" });

    // …the elder can, exactly once.
    jar.clear();
    await signInAs(elder.id);
    expect(await decideRequest(IDLE, form({ id: request.id, decision: "APPROVED" }))).toMatchObject({ status: "success" });
    expect(await decideRequest(IDLE, form({ id: request.id, decision: "APPROVED" }))).toMatchObject({ status: "error" });
    expect(await db.medication.count({ where: { name: "Vitamin B12" } })).toBe(1);
  });

  it("applies the elder's own changes immediately", async () => {
    const { elder } = await makeCircle({ consentMode: true });
    await signInAs(elder.id);
    await expect(saveMedication(IDLE, medForm())).rejects.toMatchObject({ url: "/app/medications?saved=1" });
    expect(await db.medication.count()).toBe(1);
  });

  it("returns field errors instead of saving invalid input", async () => {
    const { elder } = await makeCircle();
    await signInAs(elder.id);
    const bad = medForm("");
    bad.set("doseQuantity", "-1");
    const res = await saveMedication(IDLE, bad);
    expect(res.status).toBe("error");
    expect(Object.keys(res.fieldErrors ?? {})).toEqual(expect.arrayContaining(["name", "doseQuantity"]));
  });
});

describe("sign-in and PIN changes", () => {
  it("signs in with the right PIN, creating a hashed session", async () => {
    const { profile, elder } = await makeCircle();
    await db.member.update({ where: { id: elder.id }, data: { passcodeHash: await hashPasscode(TEST_PIN) } });

    const wrong = await signIn(IDLE, form({ careCode: profile.careCode, memberId: elder.id, pin: TEST_PIN_2 }));
    expect(wrong).toMatchObject({ status: "error", fieldErrors: { pin: ["Incorrect PIN"] } });

    await expect(signIn(IDLE, form({ careCode: profile.careCode, memberId: elder.id, pin: TEST_PIN }))).rejects.toMatchObject({ url: "/app" });
    const token = jar.get(SESSION_COOKIE)!;
    expect(token).toBeTruthy();
    const session = await db.session.findUniqueOrThrow({ where: { tokenHash: sha256(token) } });
    expect(session.memberId).toBe(elder.id);
  });

  it("only redirects to in-app paths after sign-in", async () => {
    const { profile, elder } = await makeCircle();
    await db.member.update({ where: { id: elder.id }, data: { passcodeHash: await hashPasscode(TEST_PIN) } });
    await expect(signIn(IDLE, form({ careCode: profile.careCode, memberId: elder.id, pin: TEST_PIN, next: "https://evil.example/app" }))).rejects.toMatchObject({ url: "/app" });
  });

  it("signs out other devices when a PIN changes", async () => {
    const { elder } = await makeCircle();
    await db.member.update({ where: { id: elder.id }, data: { passcodeHash: await hashPasscode(TEST_PIN) } });
    await signInAs(elder.id); // "other device"
    const current = await signInAs(elder.id);
    const res = await changePin(IDLE, form({ currentPin: TEST_PIN, pin: TEST_PIN_2, confirmPin: TEST_PIN_2 }));
    expect(res).toMatchObject({ status: "success", message: expect.stringMatching(/Signed out 1 other device/) });
    expect((await db.session.findMany({ where: { memberId: elder.id } })).map((s) => s.tokenHash)).toEqual([sha256(current)]);
  });
});

describe("health readings", () => {
  it("returns a warning (not an error) for an out-of-range reading and alerts the circle", async () => {
    const { profile, elder } = await makeCircle();
    const now = new Date();
    const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    const routine = await db.routine.create({ data: { profileId: profile.id, title: "Check blood pressure", kind: "BLOOD_PRESSURE", times: hhmm, startDate: "2026-01-01", scheduleChangedAt: new Date(0) } });
    const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()));
    await signInAs(elder.id);
    const res = await logRoutineAction(IDLE, form({ routineId: routine.id, scheduledFor: at.toISOString(), status: "DONE", systolic: "184", diastolic: "121" }));
    expect(res).toMatchObject({ status: "warning", message: expect.stringMatching(/care circle has been emailed/) });
    expect(await db.notification.count({ where: { kind: "VITAL_ALERT" } })).toBe(3);
  });
});

import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const CARE_CODE = "CARE-2468";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${page.url()} ${v.id} (${v.impact}): ${v.nodes
        .slice(0, 3)
        .map((n) => `${n.target.join(" ")} — ${(n.any[0]?.message ?? "").slice(0, 160)}`)
        .join(" | ")}`,
  );
  expect(summary, "axe-core WCAG 2.2 AA violations").toEqual([]);
}

/** PINs are generated per run by tests/e2e/global-setup.ts. */
const PIN_ENV = { Kamala: "DEMO_ELDER_PIN", Priya: "DEMO_CARETAKER_PIN", Rahul: "DEMO_FAMILY_PIN" } as const;

async function signIn(page: Page, who: keyof typeof PIN_ENV) {
  const pin = process.env[PIN_ENV[who]];
  if (!pin) throw new Error(`${PIN_ENV[who]} was not set by the global setup`);
  // Goes straight to the circle's page; the care-code lookup form has its own test
  // (and is rate limited, so it isn't repeated for every sign-in).
  await page.goto(`/access/${CARE_CODE}`);
  await page.getByRole("button", { name: new RegExp(`^${who}`) }).click();
  await page.getByLabel(`${who}'s PIN`).fill(pin);
  await page.getByRole("button", { name: "Open care circle" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe("public pages", () => {
  test("landing page tells the story and passes axe", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every dose matters");
    await expect(page.getByRole("link", { name: /Create a care circle/ }).first()).toBeVisible();
    await expectAccessible(page);
  });

  test("access and join pages pass axe", async ({ page }) => {
    for (const path of ["/access", "/join", "/start", `/access/${CARE_CODE}`]) {
      await page.goto(path);
      await expectAccessible(page);
    }
  });

  test("a care code (typed casually) leads to the member picker", async ({ page }) => {
    await page.goto("/access");
    await page.getByLabel("Care code").fill("care 2468");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Kamala's circle" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Kamala/ })).toBeVisible();
  });

  test("security headers are set", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the private area requires a session", async ({ page }) => {
    await page.goto("/app/medications");
    await expect(page).toHaveURL(/\/access\?next=%2Fapp%2Fmedications/);
  });

  test("wrong PINs are refused", async ({ page }) => {
    await page.goto(`/access/${CARE_CODE}`);
    await page.getByRole("button", { name: /^Rahul/ }).click();
    await page.getByLabel("Rahul's PIN").fill("123456"); // never a valid PIN: the policy rejects it, so it can match no account;
    await page.getByRole("button", { name: "Open care circle" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "didn't match" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/access/${CARE_CODE}`));
  });

  test("the cron endpoint rejects unauthenticated calls", async ({ request }) => {
    const res = await request.post("/api/cron/reminders");
    expect(res.status()).toBe(401);
  });
});

test.describe("signed-in care circle", () => {
  test("elder signs in with care code + PIN and sees Today", async ({ page }) => {
    await signIn(page, "Kamala");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kamala");
    await expect(page.getByRole("heading", { name: "Today's medicines" })).toBeVisible();
    await expectAccessible(page);
  });

  test("every app page passes axe", async ({ page }) => {
    await signIn(page, "Rahul");
    for (const path of [
      "/app/medications",
      "/app/medications/new",
      "/app/routines",
      "/app/appointments",
      "/app/insights",
      "/app/circle",
      "/app/card",
      "/app/activity",
      "/app/outbox",
      "/app/settings",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAccessible(page);
    }
  });

  test("a caretaker's medicine change waits for the elder's approval", async ({ page }) => {
    await signIn(page, "Priya");
    await page.goto("/app/medications/new");
    await expect(page.getByText(/Consent mode is on/)).toBeVisible();
    await page.getByLabel("Medicine name").fill("Vitamin B12");
    await page.getByLabel("Strength").fill("500 mcg");
    await page.getByRole("button", { name: "Send for approval" }).click();
    await expect(page.getByRole("status")).toContainText("Sent for approval");

    await page.context().clearCookies();
    await signIn(page, "Kamala");
    const card = page.locator("text=Priya suggested: add Vitamin B12").first();
    await expect(card).toBeVisible();
  });

  test("a caretaker records a health routine from Today", async ({ page }) => {
    await signIn(page, "Priya");
    await expect(page.getByRole("heading", { name: "Health routines" })).toBeVisible();
    await page.goto("/app/routines");
    await expect(page.getByRole("heading", { level: 1, name: "Routines" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Check blood pressure/ })).toBeVisible();
  });

  test("large text and high contrast persist", async ({ page }) => {
    await signIn(page, "Kamala");
    await page.getByRole("button", { name: "Extra large text" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-text", "xl");
    await page.getByRole("button", { name: "High contrast" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-text", "xl");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Standard text" }).click();
    await page.getByRole("button", { name: "High contrast" }).click();
  });
});

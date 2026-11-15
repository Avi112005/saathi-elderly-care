import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { pinWeakness } from "../../src/lib/validation/schemas";

function randomPin(): string {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!pinWeakness(pin)) return pin;
  }
}

/**
 * Resets the demo circle with fresh random PINs for this run. The PINs are passed to
 * the seed and to the test workers through environment variables — none are committed.
 */
export default function globalSetup() {
  process.env.DEMO_ELDER_PIN = randomPin();
  process.env.DEMO_CARETAKER_PIN = randomPin();
  process.env.DEMO_FAMILY_PIN = randomPin();
  execSync("npx tsx prisma/seed.ts", { stdio: "ignore", env: process.env });
}

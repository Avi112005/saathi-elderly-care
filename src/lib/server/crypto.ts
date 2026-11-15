import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** scrypt parameters (OWASP-recommended minimum N=2^17 is costly for PINs on small hosts; 2^15 with r=8 ≈ 32 MiB). */
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 } as const;

/** Hashes a passcode as `scrypt$N$r$p$salt$hash` (base64url parts). */
export async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(passcode, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Constant-time verification of a passcode against a stored hash. */
export async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, "base64url");
  const key = await scrypt(passcode, Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** A 256-bit URL-safe random token (session cookies). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Crockford-style alphabet without look-alikes (0/O, 1/I/L) — easy to read aloud over the phone. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Public identifier of a care circle, e.g. "K7QM-4XPA" (~40 bits). */
export function generateCareCode(): string {
  return `${randomCode(4)}-${randomCode(4)}`;
}

/** One-time invite code, e.g. "JOIN-8KD2-QF7M" (~60 bits; stored only as a hash). */
export function generateInviteCode(): string {
  return `JOIN-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;
}

/** Normalises a typed care code ("k7qm 4xpa" → "K7QM-4XPA"). */
export function formatCareCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : raw.toUpperCase().trim();
}

export function formatInviteCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = clean.startsWith("JOIN") ? clean.slice(4) : clean;
  return body.length === 12
    ? `JOIN-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`
    : raw.toUpperCase().trim();
}

export const CARE_CODE_PATTERN = /^[A-HJ-KMNP-Z2-9]{4}-[A-HJ-KMNP-Z2-9]{4}$/;

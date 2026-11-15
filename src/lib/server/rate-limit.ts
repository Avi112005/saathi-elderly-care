/**
 * Fixed-window in-memory rate limiter. Adequate for a single Node instance; for a
 * multi-instance deployment swap the Map for Redis with the same interface. Per-member
 * lockout (stored in the database) is the primary brute-force defence — this limiter
 * additionally stops one client hammering many members.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    this.sweep(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.limit - 1, retryAfterSec: 0 };
    }
    entry.count++;
    const allowed = entry.count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - entry.count),
      retryAfterSec: allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Drops expired windows so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (this.hits.size < 5_000) return;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

interface Limiters {
  login: RateLimiter;
  circle: RateLimiter;
  lookup: RateLimiter;
  signup: RateLimiter;
  email: RateLimiter;
}

function createLimiters(): Limiters {
  return {
    /** Passcode attempts per client IP: 20 per 15 minutes. */
    login: new RateLimiter(20, 15 * 60_000),
    /**
     * Passcode attempts per care circle, whatever the client IP: 40 per 15 minutes. The IP
     * comes from X-Forwarded-For, which a client can forge when no proxy overwrites it, so
     * this per-circle cap (plus per-member lockout) bounds guessing even then.
     */
    circle: new RateLimiter(40, 15 * 60_000),
    /** Care-code lookups per IP: 30 per 10 minutes (stops code enumeration). */
    lookup: new RateLimiter(30, 10 * 60_000),
    /** Profile creation / invite redemption per IP: 10 per hour. */
    signup: new RateLimiter(10, 60 * 60_000),
    /** Manual "send test email" / "run reminders now" per member: 10 per 10 minutes. */
    email: new RateLimiter(10, 10 * 60_000),
  };
}

// Kept on globalThis so counters survive dev hot-reloads; any limiter added since the
// process started is filled in rather than missing.
const globalLimiters = globalThis as unknown as { __saathiLimiters?: Partial<Limiters> };
globalLimiters.__saathiLimiters = { ...createLimiters(), ...globalLimiters.__saathiLimiters };

export const limiters = globalLimiters.__saathiLimiters as Limiters;

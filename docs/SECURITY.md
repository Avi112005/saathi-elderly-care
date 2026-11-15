# Security model

## Threat model (what we defend against)

| Threat                                  | Defence                                                                                                   | Where                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Guessing someone's PIN                  | scrypt hashing, weak-PIN policy, 5-attempt lockout per member, per-circle and per-IP rate limits          | `lib/server/crypto.ts`, `lib/server/circle-service.ts`, `lib/server/rate-limit.ts` |
| Enumerating care codes                  | ~40-bit random codes, rate-limited lookups, only first names shown                                        | `app/actions/auth.ts`, `app/access/[code]/page.tsx`                                |
| Learning valid member ids by timing     | Unknown members still run a full scrypt verification                                                      | `authenticate()`                                                                   |
| Stolen database                         | PINs, session tokens and invite codes are stored only as hashes                                           | schema + crypto                                                                    |
| Session theft via XSS                   | HttpOnly `__Host-` cookies, nonce-based CSP with `strict-dynamic`, React escaping                         | `proxy.ts`, `lib/server/session.ts`                                                |
| Stolen/old device after a PIN change    | Changing a PIN revokes every other session                                                                | `revokeOtherSessions()`                                                            |
| Prototype pollution via form fields     | Null-prototype objects, `__proto__`/`constructor` keys dropped                                            | `formToObject()`                                                                   |
| Forged client IP                        | Per-circle attempt cap independent of `X-Forwarded-For`                                                   | `lib/server/rate-limit.ts`                                                         |
| Stale data                              | Expired sessions, used/revoked invites, 180-day-old outbox purged hourly                                  | `lib/server/housekeeping.ts`                                                       |
| Clickjacking                            | `frame-ancestors 'none'` + `X-Frame-Options: DENY`                                                        | `proxy.ts`, `next.config.ts`                                                       |
| CSRF                                    | Server Actions Origin check, `SameSite=Lax`                                                               | Next.js runtime                                                                    |
| IDOR (reading another circle's data)    | Every query filters by the session's `profileId`; services re-check ownership                             | all actions/pages                                                                  |
| Forged dose logs                        | The instant must be a real scheduled dose, within −3 days … +3 hours                                      | `recordDose()`                                                                     |
| Privilege escalation                    | One permission matrix; only the elder may approve changes or disable consent; nobody can remove the elder | `lib/domain/permissions.ts`                                                        |
| Email header injection / HTML injection | Subjects stripped of CR/LF; every user value HTML-escaped; previews in a sandboxed iframe                 | `lib/email/templates.ts`, outbox page                                              |
| Duplicate / runaway emails              | Unique dedupe key per email; 24 h lookback cap after downtime                                             | `lib/email/mailer.ts`, `lib/domain/escalation.ts`                                  |
| Open redirect                           | `?next=` must match `/app/...`                                                                            | `safeNext()`                                                                       |
| Unauthorised cron calls                 | Bearer secret compared in constant time                                                                   | `app/api/cron/reminders/route.ts`                                                  |

## Operational notes

- Generate `CRON_SECRET` with `openssl rand -hex 32`.
- There is no passwordless or "demo" sign-in path: the demo circle uses the same PIN flow. Its PINs come from `DEMO_*_PIN` env vars or are generated at random by the seed — none are committed.
- Changing a PIN signs the member out of every other device.
- Run behind HTTPS; cookies are `Secure` when `NODE_ENV=production`.
- The in-memory rate limiter is per-instance; for horizontally-scaled deployments back it with Redis (same interface).
- Report vulnerabilities privately to the maintainers rather than opening a public issue.

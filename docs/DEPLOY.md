# Deploying Saathi — Vercel + Supabase

```
Browser ──► Vercel (Next.js app)  ──► Supabase Postgres  (schema "saathi")
                ▲                          │
                └── POST /api/cron/reminders ◄── Supabase pg_cron, every minute
```

* **Vercel** runs the app. Serverless functions sleep between requests, so the in-process reminder timer is off there (automatically).
* **Supabase** hosts PostgreSQL **and** triggers the reminder engine every minute with `pg_cron` + `pg_net`. The sweep is idempotent, so a late or doubled call never sends a duplicate email.
* Local development and the test suite keep using SQLite. `scripts/prisma.mjs` switches Prisma to PostgreSQL whenever `DATABASE_URL` starts with `postgres://` — no code changes between environments. CI runs the full test suite on both databases.

Total time: about 15 minutes. Everything below fits in the free tiers.

---

## 1. Create the database (Supabase)

1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to your users (e.g. **Mumbai / ap-south-1** for India) and save the database password.
2. Open **Connect** (top of the project dashboard) and copy two connection strings:
   * **Transaction pooler** (port **6543**) → this is `DATABASE_URL`
   * **Session pooler** (port **5432**) → this is `DIRECT_URL`
3. Add parameters to the end of each:

   | Variable | Append |
   |---|---|
   | `DATABASE_URL` | `?pgbouncer=true&connection_limit=1&schema=saathi` |
   | `DIRECT_URL` | `?schema=saathi` |

   > **Why `schema=saathi`?** Supabase automatically exposes tables in the `public` schema through its REST Data API. Putting Saathi's tables in their own schema keeps health data off that API entirely — the app only talks to the database directly.
   >
   > **Why `pgbouncer=true&connection_limit=1`?** Serverless functions open many short connections; the transaction pooler shares them, and these flags make Prisma work correctly with it.

## 2. Create the tables and the demo circle (from your machine)

```bash
cp .env.remote.example .env.remote     # git-ignored — paste the two URLs into it
npm run remote:setup
```

This creates every table in Supabase, loads the demo circle (care code **CARE-2468**) and prints its three sign-in PINs once — note them down. Set `DEMO_ELDER_PIN`, `DEMO_CARETAKER_PIN`, `DEMO_FAMILY_PIN` in `.env.remote` first if you want to choose them. Your local setup is switched back to SQLite automatically afterwards.

Skip the demo data in a real deployment: run `node --env-file=.env.remote scripts/prisma.mjs db push` instead.

## 3. Deploy the app (Vercel)

1. **Add New → Project**, import the GitHub repository. Framework preset: Next.js (detected). Keep the default build command (`npm run build`).
2. Add these **Environment Variables** (Production, and Preview if you use it):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Transaction-pooler URL from step 1 (with the appended parameters) |
   | `DIRECT_URL` | Session-pooler URL from step 1 |
   | `CRON_SECRET` | A long random string — generate with `openssl rand -hex 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `REMINDER_SCHEDULER` | `off` |
   | `APP_URL` | Your Vercel URL, e.g. `https://saathi-elderly-care.vercel.app` (used in email links) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | See step 5 |

3. **Deploy.** If you didn't know the final URL yet, set `APP_URL` afterwards and redeploy.
4. Optional but faster: **Settings → Functions → Function Region** → the region nearest your Supabase project (e.g. `bom1` Mumbai).

## 4. Trigger reminders every minute (Supabase SQL Editor)

**Database → Extensions**: enable **pg_cron** and **pg_net**. Then run in the **SQL Editor**, replacing the two placeholders:

```sql
-- Store the endpoint and secret encrypted in Supabase Vault (not in the job text).
select vault.create_secret('https://YOUR-APP.vercel.app/api/cron/reminders', 'saathi_cron_url');
select vault.create_secret('YOUR_CRON_SECRET', 'saathi_cron_secret');

-- Call the reminder engine every minute.
select cron.schedule(
  'saathi-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'saathi_cron_url'),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'saathi_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
```

Check it is working (after a minute or two):

```sql
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select status_code, content, created from net._http_response order by created desc limit 5;
-- Expect status_code 200 and a body like {"ok":true,"profiles":1,...}
```

To stop it: `select cron.unschedule('saathi-reminders');`

> No Supabase cron? Any scheduler that can send an HTTP request every minute works — e.g. a free [cron-job.org](https://cron-job.org) job: `POST https://YOUR-APP.vercel.app/api/cron/reminders` with header `Authorization: Bearer YOUR_CRON_SECRET`.

## 5. Email (SMTP)

Without SMTP settings the app still works — every email is written to the in-app **Email outbox** as *Preview*. To deliver for real, pick one:

| Provider | Settings | Notes |
|---|---|---|
| **Gmail** (quickest for a demo) | `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<16-char app password>`, `EMAIL_FROM="Saathi <you@gmail.com>"` | Needs 2-Step Verification; create the password at Google Account → Security → App passwords. ~500 emails/day. |
| **Brevo** | `smtp-relay.brevo.com`, port `587`, `SMTP_SECURE=false`, SMTP login + key from the dashboard | 300 emails/day free; verify the sender address. |
| **Resend** | `smtp.resend.com`, port `465`, `SMTP_SECURE=true`, user `resend`, pass = API key | Needs a verified domain to email anyone other than yourself. |

Then sign in, open **Email outbox → Send me a test email**. Status **Sent** means delivery works; **Failed** shows the SMTP error.

## 6. Smoke test

* `https://YOUR-APP.vercel.app/api/health` → `{"status":"ok","database":"up"}`
* Landing page → **Open Kamala's demo circle** → sign in with a PIN printed in step 2.
* **Email outbox** fills up as doses and appointments come due (the demo has some within minutes of seeding).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build log shows `[prisma] SQLite → prisma generate` | `DATABASE_URL` isn't set for the build environment in Vercel. |
| `prepared statement "s0" already exists` | `pgbouncer=true` is missing from `DATABASE_URL`. |
| `P1001: Can't reach database server` | Wrong host/port or password; use the **pooler** URLs (the direct `db.*.supabase.co` host is IPv6-only). |
| `net._http_response` shows 401 | The Vault secret doesn't match Vercel's `CRON_SECRET` (no `Bearer ` prefix in the stored secret). |
| Emails stay *Preview* | SMTP variables aren't set in Vercel — redeploy after adding them. |
| Tables appear in the Supabase Table Editor under `public` | The URLs are missing `schema=saathi`; re-run step 2 with it. |

## Notes for production

* The in-memory rate limiter is per serverless instance. The per-member PIN lockout and per-circle limits are stored in or keyed on the database/circle and remain effective; for strict global IP limits back `RateLimiter` with Redis (e.g. Upstash).
* Don't run the demo seed against a real deployment.
* Supabase takes daily backups on paid plans; on the free plan, export regularly if the data matters.

import nodemailer, { type Transporter } from "nodemailer";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { NotificationKind } from "@/lib/domain/types";
import type { RenderedEmail } from "./templates";

export interface Mailer {
  /** True when a real SMTP transport is configured. */
  readonly live: boolean;
  send(message: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

let cached: Mailer | null = null;

/** SMTP mailer from environment variables, or a no-op "outbox only" mailer when unset. */
export function getMailer(): Mailer {
  if (cached) return cached;
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    cached = { live: false, send: async () => undefined };
    return cached;
  }
  const transport: Transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    pool: true,
    maxConnections: 3,
  });
  const from = process.env.EMAIL_FROM ?? "Saathi Care <reminders@example.com>";
  cached = {
    live: true,
    send: async (m) => {
      await transport.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html });
    },
  };
  return cached;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export interface OutgoingEmail {
  profileId: string;
  memberId: string | null;
  to: string;
  kind: NotificationKind;
  /** Globally unique key — the same reminder is never sent twice. */
  dedupeKey: string;
  email: RenderedEmail;
}

export type DeliveryResult = "SENT" | "LOGGED" | "FAILED" | "DUPLICATE";

/**
 * Records the email in the outbox and delivers it. The outbox row is inserted first
 * under a unique `dedupeKey`; if another scheduler run already claimed that key the
 * insert fails and nothing is sent. This makes every reminder exactly-once even when
 * the in-process scheduler and an external cron overlap.
 */
export async function deliver(db: PrismaClient, mailer: Mailer, out: OutgoingEmail): Promise<DeliveryResult> {
  // Fast path: most sweeps re-see reminders that already went out. The unique insert below
  // remains the real guarantee when two sweeps race.
  if (await db.notification.findUnique({ where: { dedupeKey: out.dedupeKey }, select: { id: true } }))
    return "DUPLICATE";
  let id: string;
  try {
    const row = await db.notification.create({
      data: {
        profileId: out.profileId,
        memberId: out.memberId,
        toEmail: out.to,
        kind: out.kind,
        subject: out.email.subject,
        bodyText: out.email.text,
        bodyHtml: out.email.html,
        dedupeKey: out.dedupeKey,
        status: "QUEUED",
      },
      select: { id: true },
    });
    id = row.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "DUPLICATE";
    throw err;
  }

  if (!mailer.live) {
    await db.notification.update({ where: { id }, data: { status: "LOGGED", sentAt: new Date() } });
    return "LOGGED";
  }
  try {
    await mailer.send({ to: out.to, subject: out.email.subject, text: out.email.text, html: out.email.html });
    await db.notification.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    return "SENT";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mailer] delivery failed for ${out.kind}: ${message}`);
    await db.notification.update({ where: { id }, data: { status: "FAILED", error: message.slice(0, 500) } });
    return "FAILED";
  }
}

import type { Metadata } from "next";
import { DateTime } from "luxon";
import { prisma } from "@/lib/server/db";
import { requireMember } from "@/lib/server/session";
import { can, canManageMember } from "@/lib/domain/permissions";
import { ROLE_LABEL, ROLE_ORDER, isRole } from "@/lib/domain/types";
import { maskEmail } from "@/lib/domain/format";
import { ConsentToggle, InviteForm, MemberControls, RequestDecision, RevokeInviteButton } from "@/components/app/action-forms";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Care circle" };

const ROLE_TONE = { ELDER: "marigold", CARETAKER: "sage", FAMILY: "sky" } as const;

export default async function CirclePage() {
  const member = await requireMember();
  const now = new Date();
  const [members, invites, requests] = await Promise.all([
    prisma.member.findMany({ where: { profileId: member.profileId, active: true }, orderBy: { createdAt: "asc" } }),
    prisma.invite.findMany({ where: { profileId: member.profileId, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.changeRequest.findMany({ where: { profileId: member.profileId }, include: { requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const rank = (role: string) => (isRole(role) ? ROLE_ORDER[role] : 3);
  members.sort((a, b) => rank(a.role) - rank(b.role));
  const manage = can(member, "circle:manage");
  const zone = member.profile.timezone;
  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING").slice(0, 6);
  const hasElder = members.some((m) => m.role === "ELDER");

  return (
    <>
      <PageHeader
        eyebrow={`Care code · ${member.profile.careCode}`}
        title="Care circle"
        description={`The people looking after ${member.role === "ELDER" ? "you" : member.profile.preferredName}, what each of them can do, and decisions waiting on the elder.`}
      />

      <section id="requests" aria-labelledby="requests-title" className="scroll-mt-24">
        <h2 id="requests-title" className="mb-3 flex items-center gap-2 text-3xl">
          Waiting for approval {pending.length > 0 && <Badge tone="marigold">{pending.length}</Badge>}
        </h2>
        {pending.length === 0 ? (
          <Card className="p-5 text-ink-2">Nothing is waiting. Changes proposed by caretakers and family appear here for the elder to approve.</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((r) => (
              <li key={r.id}>
                <Card className="border-marigold-200 bg-marigold-50 p-5">
                  <p className="font-serif text-2xl leading-snug">
                    {r.requestedBy.name} suggested: {r.summary}
                  </p>
                  <p className="mb-3 text-sm text-ink-2">{DateTime.fromJSDate(r.createdAt).setZone(zone).toRelative()}</p>
                  <RequestDecision id={r.id} canDecide={can(member, "request:decide")} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="consent-title" className="mt-10">
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="max-w-xl">
            <h2 id="consent-title" className="flex items-center gap-2 text-2xl">
              <Icon name="heart" className="size-6 text-marigold-600" /> Consent mode is {member.profile.consentMode ? "on" : "off"}
            </h2>
            <p className="mt-1 text-ink-2">
              {member.profile.consentMode
                ? "Medicine changes by anyone other than the elder wait for the elder's approval."
                : hasElder
                  ? "Caretakers and admins can change medicines directly. Every change is still logged."
                  : "Add a sign-in for the elder to let them approve changes."}
            </p>
          </div>
          <ConsentToggle enabled={member.profile.consentMode} canDisable={can(member, "consent:disable")} canEnable={manage && hasElder} />
        </Card>
      </section>

      <section aria-labelledby="members-title" className="mt-10">
        <h2 id="members-title" className="mb-3 text-3xl">Members</h2>
        <ul className="flex flex-col gap-3">
          {members.map((m) => {
            const role = isRole(m.role) ? m.role : "FAMILY";
            const locked = m.lockedUntil !== null && m.lockedUntil > now;
            const isMe = m.id === member.id;
            return (
              <li key={m.id}>
                <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="flex flex-1 items-center gap-4">
                    <Avatar name={m.name} color={m.avatarColor} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {m.name} {isMe && <span className="text-sm font-normal text-ink-2">(you)</span>}
                        <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>
                        {m.isAdmin && role !== "ELDER" && <Badge tone="ink">Admin</Badge>}
                        {locked && <Badge tone="rose"><Icon name="lock" className="size-3" /> Paused</Badge>}
                      </p>
                      <p className="text-sm text-ink-2">
                        {[m.relationship, m.email ? (isMe || manage ? m.email : maskEmail(m.email)) : "No email", m.lastSeenAt ? `active ${DateTime.fromJSDate(m.lastSeenAt).setZone(zone).toRelative()}` : "not signed in yet"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  {canManageMember(member, { id: m.id, role }, member.id) && <MemberControls id={m.id} role={role} locked={locked} />}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {manage && (
        <section aria-labelledby="invite-title" className="mt-10">
          <h2 id="invite-title" className="mb-1 text-3xl">Invite someone</h2>
          <p className="mb-4 text-ink-2">Each invite is single-use, expires in 72 hours and is stored only as a secure hash.</p>
          <Card className="p-5 sm:p-6">
            <InviteForm />
            {invites.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="font-sans text-sm font-semibold tracking-widest text-ink-3 uppercase">Unused invites</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {invites.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-2">
                      <span className="text-sm">
                        <strong>{ROLE_LABEL[i.role as keyof typeof ROLE_LABEL]}</strong>
                        {i.label && ` for ${i.label}`} · by {i.createdBy.name} · expires {DateTime.fromJSDate(i.expiresAt).setZone(zone).toRelative()}
                      </span>
                      <RevokeInviteButton id={i.id} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </section>
      )}

      {decided.length > 0 && (
        <section aria-labelledby="decided-title" className="mt-10">
          <h2 id="decided-title" className="mb-3 text-2xl">Recent decisions</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  {r.requestedBy.name}: {r.summary}
                </span>
                <Badge tone={r.status === "APPROVED" ? "sage" : "ink"}>
                  {r.status === "APPROVED" ? "Approved" : "Declined"}
                  {r.decidedBy ? ` by ${r.decidedBy.name}` : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

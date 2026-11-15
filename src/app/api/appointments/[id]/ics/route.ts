import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getCurrentMember } from "@/lib/server/session";
import { buildIcs } from "@/lib/domain/ics";

export const dynamic = "force-dynamic";

/** Calendar file for one appointment. Only members of the appointment's circle may download it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const appt = await prisma.appointment.findFirst({ where: { id, profileId: member.profileId } });
  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questions = appt.questions.split("\n").filter(Boolean);
  const description = [
    appt.doctorName && `Doctor: ${appt.doctorName}`,
    appt.transport && `Getting there: ${appt.transport}`,
    appt.notes && `Notes: ${appt.notes}`,
    questions.length ? `Questions:\n- ${questions.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const body = buildIcs({ id: appt.id, title: `${appt.title} (${member.profile.preferredName})`, startsAt: appt.startsAt, durationMin: appt.durationMin, location: appt.location, description });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointment-${appt.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

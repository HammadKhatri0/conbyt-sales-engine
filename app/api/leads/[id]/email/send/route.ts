// app/api/leads/[id]/email/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendGmailEmail } from "@/lib/gmail";
import { getSettings } from "@/lib/settings";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.email) {
      return NextResponse.json({ error: "This lead has no email address on file" }, { status: 400 });
    }

    if (lead.isSuppressed) {
      return NextResponse.json({ error: "This lead is on the suppression list" }, { status: 400 });
    }

    // Allow sending an edited version without persisting a re-generate first.
    const body = await req.json().catch(() => ({}));
    const subject: string | undefined = body.subject ?? lead.emailSubject ?? undefined;
    const emailBody: string | undefined = body.body ?? lead.emailBody ?? undefined;

    if (!subject || !emailBody) {
      return NextResponse.json({ error: "No email content to send — generate one first" }, { status: 400 });
    }

    const settings = await getSettings();
    const maxPerDay = settings.maxEmailsPerDay ?? 100;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sentToday = await prisma.lead.count({
      where: { emailSentAt: { gte: startOfDay } },
    });

    if (sentToday >= maxPerDay) {
      return NextResponse.json(
        { error: `Daily send limit reached (${maxPerDay}/day, set in Settings)` },
        { status: 429 }
      );
    }

    const result = await sendGmailEmail({ to: lead.email, subject, body: emailBody });
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to send email" }, { status: 500 });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { emailSubject: subject, emailBody, emailSentAt: new Date() },
    });

    return NextResponse.json({ success: true, lead: updated });
  } catch (err) {
    console.error(`Failed to send email for lead ${id}:`, err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}

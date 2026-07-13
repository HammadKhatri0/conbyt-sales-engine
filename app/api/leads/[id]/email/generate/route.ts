// app/api/leads/[id]/email/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOutboundEmail } from "@/lib/email-generation";
import { getActiveICPProfile } from "@/lib/icp";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const icp = await getActiveICPProfile();
    if (!icp) {
      return NextResponse.json({ error: "No active ICP profile — set one up in Settings first" }, { status: 400 });
    }

    const email = await generateOutboundEmail(lead, icp);
    if (!email) {
      return NextResponse.json({ error: "Failed to generate email — check the Gemini API key in Settings" }, { status: 500 });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        emailSubject: email.subject,
        emailBody: email.body,
        emailGeneratedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, lead: updated });
  } catch (err) {
    console.error(`Failed to generate email for lead ${id}:`, err);
    return NextResponse.json({ error: "Failed to generate email" }, { status: 500 });
  }
}

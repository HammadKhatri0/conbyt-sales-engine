// app/api/campaigns/active/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { status: { in: ["RUNNING", "PAUSED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        leads: {
          select: { id: true, status: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ campaign: null });
    }

    const currentLead = campaign.currentLeadId
      ? await prisma.lead.findUnique({ where: { id: campaign.currentLeadId } })
      : null;

    const queuedCount = campaign.leads.filter((l) => l.status === "QUEUED").length;
    const calledCount = campaign.leads.filter((l) => l.status !== "QUEUED").length;

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalLeads: campaign.leads.length,
        queuedCount,
        calledCount,
        currentLead: currentLead
          ? { id: currentLead.id, name: currentLead.name, phone: currentLead.phone }
          : null,
      },
    });
  } catch (err) {
    console.error("Failed to fetch active campaign:", err);
    return NextResponse.json({ error: "Failed to fetch active campaign" }, { status: 500 });
  }
}
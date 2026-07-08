// app/api/campaigns/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { name, leadIds } = await req.json();

    if (!name || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "Name and at least one lead ID are required" }, { status: 400 });
    }

    const campaign = await prisma.campaign.create({
      data: { name, status: "DRAFT" },
    });

    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { campaignId: campaign.id },
    });

    return NextResponse.json({ success: true, campaign });
  } catch (err) {
    console.error("Failed to create campaign:", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
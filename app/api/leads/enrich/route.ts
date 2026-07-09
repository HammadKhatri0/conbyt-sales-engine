// app/api/leads/enrich/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichmentQueue } from "@/lib/queues";

export async function POST(req: NextRequest) {
  try {
    const { leadIds } = (await req.json()) as { leadIds: string[] };

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
    }

    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { enrichmentStatus: "PENDING" },
    });

    for (const leadId of leadIds) {
      await enrichmentQueue.add("enrich-lead", { leadId });
    }

    return NextResponse.json({ success: true, queued: leadIds.length });
  } catch (err) {
    console.error("Failed to queue enrichment:", err);
    return NextResponse.json({ error: "Failed to queue enrichment" }, { status: 500 });
  }
}
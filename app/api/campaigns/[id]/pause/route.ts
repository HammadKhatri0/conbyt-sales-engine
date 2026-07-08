// app/api/campaigns/[id]/pause/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pauseCampaign } from "@/lib/campaign-engine";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await pauseCampaign(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to pause campaign ${id}:`, err);
    return NextResponse.json({ error: "Failed to pause campaign" }, { status: 500 });
  }
}
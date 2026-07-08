// app/api/campaigns/[id]/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { startCampaign } from "@/lib/campaign-engine";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await startCampaign(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to start campaign ${id}:`, err);
    return NextResponse.json({ error: "Failed to start campaign" }, { status: 500 });
  }
}
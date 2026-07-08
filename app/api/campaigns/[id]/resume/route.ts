// app/api/campaigns/[id]/resume/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resumeCampaign } from "@/lib/campaign-engine";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await resumeCampaign(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to resume campaign ${id}:`, err);
    return NextResponse.json({ error: "Failed to resume campaign" }, { status: 500 });
  }
}
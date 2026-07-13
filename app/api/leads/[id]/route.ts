// app/api/leads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        callAttempts: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (err) {
    console.error(`Failed to fetch lead ${id}:`, err);
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();

    // Only allow a known, safe set of fields to be updated this way —
    // prevents accidentally exposing every column to arbitrary client writes.
    const allowedFields = ["notes", "status", "isSuppressed", "callbackAt", "campaignId"];
    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key];
    }

    const lead = await prisma.lead.update({ where: { id }, data });
    return NextResponse.json({ success: true, lead });
  } catch (err) {
    console.error(`Failed to update lead ${id}:`, err);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete lead ${id}:`, err);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
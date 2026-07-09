// app/api/proof-points/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.proofPoint.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete proof point ${id}:`, err);
    return NextResponse.json({ error: "Failed to delete proof point" }, { status: 500 });
  }
}
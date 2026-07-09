// app/api/icp-profiles/[id]/activate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Deactivate every profile, then activate only this one — done as a
    // transaction so there's never a moment with zero or two active profiles.
    await prisma.$transaction([
      prisma.iCPProfile.updateMany({ data: { isActive: false } }),
      prisma.iCPProfile.update({ where: { id }, data: { isActive: true } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to activate ICP profile ${id}:`, err);
    return NextResponse.json({ error: "Failed to activate profile" }, { status: 500 });
  }
}
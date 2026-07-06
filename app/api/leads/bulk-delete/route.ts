// app/api/leads/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { ids } = (await req.json()) as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
    }

    const result = await prisma.lead.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (err) {
    console.error("Bulk delete error:", err);
    return NextResponse.json({ error: "Failed to delete leads" }, { status: 500 });
  }
}
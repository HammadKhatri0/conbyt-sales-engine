// app/api/proof-points/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const proofPoints = await prisma.proofPoint.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ proofPoints });
  } catch (err) {
    console.error("Failed to fetch proof points:", err);
    return NextResponse.json({ error: "Failed to fetch proof points" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name?.trim() || !body.metric?.trim() || !body.description?.trim()) {
      return NextResponse.json(
        { error: "Name, metric, and description are all required" },
        { status: 400 }
      );
    }

    const proofPoint = await prisma.proofPoint.create({
      data: {
        name: body.name.trim(),
        metric: body.metric.trim(),
        description: body.description.trim(),
      },
    });

    return NextResponse.json({ proofPoint });
  } catch (err) {
    console.error("Failed to create proof point:", err);
    return NextResponse.json({ error: "Failed to create proof point" }, { status: 500 });
  }
}
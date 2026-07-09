// app/api/icp-profiles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const profiles = await prisma.iCPProfile.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ profiles });
  } catch (err) {
    console.error("Failed to fetch ICP profiles:", err);
    return NextResponse.json({ error: "Failed to fetch ICP profiles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Profile name is required" }, { status: 400 });
    }

    const profileCount = await prisma.iCPProfile.count();

    const profile = await prisma.iCPProfile.create({
      data: {
        name: body.name.trim(),
        // First profile ever created becomes active automatically.
        isActive: profileCount === 0,
        targetIndustries: body.targetIndustries ?? [],
        employeeCountMin: body.employeeCountMin ?? null,
        employeeCountMax: body.employeeCountMax ?? null,
        geographyCountry: body.geographyCountry ?? null,
        geographyRegion: body.geographyRegion ?? null,
        targetJobTitles: body.targetJobTitles ?? [],
        excludeJobTitles: body.excludeJobTitles ?? [],
        positiveSignals: body.positiveSignals ?? [],
        negativeSignals: body.negativeSignals ?? [],
        linkedinPostKeywords: body.linkedinPostKeywords ?? [],
        websiteKeywords: body.websiteKeywords ?? [],
        minScoreThreshold: body.minScoreThreshold ?? 7,
        competitorTools: body.competitorTools ?? [],
        idealCustomerDescription: body.idealCustomerDescription ?? null,
        linkedinPresenceDescription: body.linkedinPresenceDescription ?? null,
        badFitDescription: body.badFitDescription ?? null,
        immediateCallTrigger: body.immediateCallTrigger ?? null,
      },
    });

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Failed to create ICP profile:", err);
    return NextResponse.json({ error: "Failed to create ICP profile" }, { status: 500 });
  }
}
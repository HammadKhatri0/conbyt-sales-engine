// app/api/leads/apollo-import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveICPProfile } from "@/lib/icp";
import type { ApolloPersonResult } from "@/lib/apollo";

export async function POST(req: NextRequest) {
  try {
    const { people } = (await req.json()) as { people: ApolloPersonResult[] };

    if (!Array.isArray(people) || people.length === 0) {
      return NextResponse.json({ error: "No leads provided" }, { status: 400 });
    }

    const activeProfile = await getActiveICPProfile();

    let inserted = 0;
    let skippedDuplicate = 0;
    let skippedNoPhone = 0;

    for (const person of people) {
      if (!person.phone) {
        skippedNoPhone++;
        continue;
      }

      const existing = await prisma.lead.findFirst({
        where: {
          OR: [{ apolloId: person.apolloId }, { phone: person.phone }],
        },
      });

      if (existing) {
        skippedDuplicate++;
        continue;
      }

      await prisma.lead.create({
        data: {
          name: person.name || "Unknown",
          phone: person.phone,
          email: person.email,
          company: person.company,
          website: person.website,
          industry: person.industry,
          apolloId: person.apolloId,
          employeeCount: person.employeeCount,
          location: person.location,
          jobTitle: person.jobTitle,
          seniorityLevel: person.seniorityLevel,
          source: "APOLLO",
          status: "NEW",
          enrichmentStatus: "PENDING",
          icpProfileId: activeProfile?.id ?? null,
        },
      });
      inserted++;
    }

    return NextResponse.json({
      results: { inserted, skippedDuplicate, skippedNoPhone },
    });
  } catch (err) {
    console.error("Apollo import failed:", err);
    return NextResponse.json({ error: "Apollo import failed" }, { status: 500 });
  }
}
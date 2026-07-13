// app/api/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveICPProfile } from "@/lib/icp";
import type { Prisma } from "../../../generated/prisma/client";

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const all = searchParams.get("all") === "true";
    const excludeBelowThreshold = searchParams.get("excludeBelowThreshold") === "true";
    const excludeSuppressed = searchParams.get("excludeSuppressed") === "true";

    const where: Prisma.LeadWhereInput = {
      ...(status ? { status: status as any } : {}),
      ...(excludeSuppressed ? { isSuppressed: false } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    let filteredOutCount = 0;

    if (excludeBelowThreshold) {
      const activeProfile = await getActiveICPProfile();
      if (activeProfile) {
        // Only exclude leads that HAVE been scored and fall below threshold.
        // Unscored leads (finalScore null) are left visible.
        const belowThresholdCount = await prisma.lead.count({
          where: {
            ...where,
            finalScore: { not: null, lt: activeProfile.minScoreThreshold },
          },
        });
        filteredOutCount = belowThresholdCount;

        (where as any).NOT = {
          finalScore: { not: null, lt: activeProfile.minScoreThreshold },
        };
      }
    }

    if (all) {
      const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });
      return NextResponse.json({ leads, total: leads.length, filteredOutCount });
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({ leads, total, page, pageSize: PAGE_SIZE, filteredOutCount });
  } catch (err) {
    console.error("Failed to fetch leads:", err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
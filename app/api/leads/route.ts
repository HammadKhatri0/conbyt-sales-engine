// app/api/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const all = searchParams.get("all") === "true";

    const where: Prisma.LeadWhereInput = {
      ...(status ? { status: status as any } : {}),
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

    if (all) {
      // Used only for the "Download CSV" export — no pagination limit.
      const leads = await prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ leads, total: leads.length });
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

    return NextResponse.json({ leads, total, page, pageSize: PAGE_SIZE });
  } catch (err) {
    console.error("Failed to fetch leads:", err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
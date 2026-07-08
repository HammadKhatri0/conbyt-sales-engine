// app/api/call-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

// Valid CallAttempt outcomes — deliberately excludes QUEUED/CALLING/DO_NOT_CALL,
// which are Lead statuses but never actually written as a call outcome.
const VALID_OUTCOMES = [
  "BOOKED",
  "NOT_INTERESTED",
  "LINK_EMAILED",
  "CALLBACK_REQUESTED",
  "NO_ANSWER",
  "WRONG_NUMBER",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const outcome = searchParams.get("outcome") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const all = searchParams.get("all") === "true";

    // Guard against an invalid outcome value causing an unhandled Prisma error.
    if (outcome && !VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: "Invalid outcome filter" }, { status: 400 });
    }

    const where: Prisma.CallAttemptWhereInput = {
      ...(outcome ? { outcome: outcome as any } : {}),
      ...(search
        ? {
            lead: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    if (all) {
      // Used only for the "Download all" CSV export — no pagination limit.
      const callAttempts = await prisma.callAttempt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          lead: {
            select: { id: true, name: true, phone: true, company: true, industry: true },
          },
        },
      });
      return NextResponse.json({ callAttempts, total: callAttempts.length });
    }

    const [callAttempts, total] = await Promise.all([
      prisma.callAttempt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          lead: {
            select: { id: true, name: true, phone: true, company: true, industry: true },
          },
        },
      }),
      prisma.callAttempt.count({ where }),
    ]);

    return NextResponse.json({ callAttempts, total, page, pageSize: PAGE_SIZE });
  } catch (err) {
    console.error("Failed to fetch call history:", err);
    return NextResponse.json({ error: "Failed to fetch call history" }, { status: 500 });
  }
}
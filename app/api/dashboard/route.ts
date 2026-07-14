// app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ACTIVITY_LIMIT = 15;
const BOOKING_CHART_DAYS = 14;

export async function GET() {
  try {
    const [totalLeads, totalCalls, totalBooked, activeCampaigns, emailsSent, contactedCount, positiveOutcomeCount] =
      await Promise.all([
        prisma.lead.count(),
        prisma.callAttempt.count(),
        prisma.lead.count({ where: { status: "BOOKED" } }),
        prisma.campaign.count({ where: { status: "RUNNING" } }),
        prisma.lead.count({ where: { emailSentAt: { not: null } } }),
        prisma.lead.count({
          where: { OR: [{ status: { notIn: ["NEW", "QUEUED"] } }, { emailSentAt: { not: null } }] },
        }),
        prisma.lead.count({ where: { status: { in: ["BOOKED", "LINK_EMAILED", "CALLBACK_REQUESTED"] } } }),
      ]);

    const bookingRate = totalLeads > 0 ? totalBooked / totalLeads : 0;

    const funnel = [
      { label: "Total Leads", count: totalLeads },
      { label: "Contacted", count: contactedCount },
      { label: "Positive Outcome", count: positiveOutcomeCount },
      { label: "Booked", count: totalBooked },
    ];

    // Bookings per day for the last 14 days, bucketed in JS rather than a
    // raw SQL date_trunc so this stays portable — dataset size at this
    // stage of the product doesn't warrant it.
    const since = new Date();
    since.setDate(since.getDate() - (BOOKING_CHART_DAYS - 1));
    since.setHours(0, 0, 0, 0);

    const bookedAttempts = await prisma.callAttempt.findMany({
      where: { outcome: "BOOKED", createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const dayBuckets = new Map<string, number>();
    for (let i = 0; i < BOOKING_CHART_DAYS; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      dayBuckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const a of bookedAttempts) {
      const key = a.createdAt.toISOString().slice(0, 10);
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    }
    const bookingsByDay = Array.from(dayBuckets.entries()).map(([date, count]) => ({ date, count }));

    const [recentCalls, recentEmails] = await Promise.all([
      prisma.callAttempt.findMany({
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
        include: { lead: { select: { id: true, name: true } } },
      }),
      prisma.lead.findMany({
        where: { emailSentAt: { not: null } },
        orderBy: { emailSentAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: { id: true, name: true, emailSentAt: true, emailSubject: true },
      }),
    ]);

    const activity = [
      ...recentCalls.map((c) => ({
        type: "call" as const,
        leadId: c.lead.id,
        leadName: c.lead.name,
        detail: c.outcome ? c.outcome.replace(/_/g, " ") : "Call completed",
        timestamp: c.createdAt.toISOString(),
      })),
      ...recentEmails
        .filter((e) => e.emailSentAt)
        .map((e) => ({
          type: "email" as const,
          leadId: e.id,
          leadName: e.name,
          detail: e.emailSubject ?? "Email sent",
          timestamp: e.emailSentAt!.toISOString(),
        })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, ACTIVITY_LIMIT);

    return NextResponse.json({
      summary: { totalLeads, totalCalls, totalBooked, bookingRate, activeCampaigns, emailsSent },
      funnel,
      bookingsByDay,
      activity,
    });
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}

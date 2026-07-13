// app/api/leads/sheets-export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportRowsToSheet } from "@/lib/google-sheets";

export async function POST(req: NextRequest) {
  try {
    const { leadIds, spreadsheetUrl, sheetName } = await req.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "No leads to export" }, { status: 400 });
    }
    if (!spreadsheetUrl || !sheetName) {
      return NextResponse.json({ error: "Spreadsheet URL and tab name are required" }, { status: 400 });
    }

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Name", "Phone", "Email", "Company", "Industry", "Job Title",
      "Location", "Website", "Status", "Score",
    ];
    const rows = leads.map((l) => [
      l.name,
      l.phone,
      l.email ?? "",
      l.company ?? "",
      l.industry ?? "",
      l.jobTitle ?? "",
      l.location ?? "",
      l.website ?? "",
      l.status,
      l.finalScore != null ? String(l.finalScore) : "",
    ]);

    const { sheetUrl } = await exportRowsToSheet(spreadsheetUrl, sheetName, headers, rows);

    return NextResponse.json({ success: true, exportedCount: leads.length, sheetUrl });
  } catch (err: any) {
    console.error("Failed to export leads to sheet:", err);
    return NextResponse.json({ error: err?.message ?? "Failed to export leads" }, { status: 500 });
  }
}

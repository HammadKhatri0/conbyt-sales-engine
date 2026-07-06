// app/api/leads/sheets-import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSheetData } from "@/lib/google-sheets";

// Step 1: fetch headers + preview rows so the user can map columns
export async function POST(req: NextRequest) {
  try {
    const { sheetUrl } = await req.json();

    if (!sheetUrl) {
      return NextResponse.json({ error: "Sheet URL is required" }, { status: 400 });
    }

    const { headers, rows } = await fetchSheetData(sheetUrl);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in this sheet" }, { status: 400 });
    }

    return NextResponse.json({ headers, rows });
  } catch (err: any) {
    console.error("Google Sheets fetch error:", err);

    // Give a clearer message for the most common failure mode
    const message = err?.message?.includes("403") || err?.code === 403
      ? "Permission denied. Make sure the sheet is shared with the service account's email as a Viewer."
      : err?.message || "Failed to fetch sheet data";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
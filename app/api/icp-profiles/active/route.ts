// app/api/icp-profiles/active/route.ts
import { NextResponse } from "next/server";
import { getActiveICPProfile } from "@/lib/icp";

export async function GET() {
  try {
    const profile = await getActiveICPProfile();
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Failed to fetch active ICP profile:", err);
    return NextResponse.json({ error: "Failed to fetch active ICP profile" }, { status: 500 });
  }
}
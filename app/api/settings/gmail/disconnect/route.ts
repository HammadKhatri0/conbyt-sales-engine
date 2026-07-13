// app/api/settings/gmail/disconnect/route.ts
import { NextResponse } from "next/server";
import { disconnectGmail } from "@/lib/gmail";

export async function POST() {
  try {
    await disconnectGmail();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to disconnect Gmail:", err);
    return NextResponse.json({ error: "Failed to disconnect Gmail" }, { status: 500 });
  }
}

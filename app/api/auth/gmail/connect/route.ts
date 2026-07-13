// app/api/auth/gmail/connect/route.ts
import { NextResponse } from "next/server";
import { getGmailAuthUrl } from "@/lib/gmail";

// Full-page redirect (not fetched via XHR) — the Settings page links straight
// here so the browser navigates through Google's consent screen.
export async function GET() {
  try {
    const authUrl = await getGmailAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error("Failed to start Gmail OAuth flow:", err);
    const message = encodeURIComponent(err?.message ?? "Failed to start Gmail connection");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?gmail=error&message=${message}`
    );
  }
}

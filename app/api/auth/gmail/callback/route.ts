// app/api/auth/gmail/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { completeGmailConnection } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (oauthError) {
    return NextResponse.redirect(`${baseUrl}/settings?gmail=error&message=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?gmail=error&message=Missing+authorization+code`);
  }

  try {
    const { email } = await completeGmailConnection(code);
    return NextResponse.redirect(`${baseUrl}/settings?gmail=connected&email=${encodeURIComponent(email)}`);
  } catch (err: any) {
    console.error("Gmail OAuth callback failed:", err);
    const message = encodeURIComponent(err?.message ?? "Failed to complete Gmail connection");
    return NextResponse.redirect(`${baseUrl}/settings?gmail=error&message=${message}`);
  }
}

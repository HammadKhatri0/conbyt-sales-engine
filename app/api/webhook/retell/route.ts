import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function verifyRetellSignature(
  rawBody: string,
  apiKey: string,
  signatureHeader: string
): boolean {
  const match = signatureHeader.match(/^v=(\d+),d=(.+)$/);
  if (!match) return false;

  const [, timestampStr, digest] = match;
  const timestamp = parseInt(timestampStr, 10);

  // Reject requests older than 5 minutes to prevent replay attacks
  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) return false;

  const expectedDigest = crypto
    .createHmac("sha256", apiKey)
    .update(rawBody + timestampStr)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "hex"),
      Buffer.from(expectedDigest, "hex")
    );
  } catch {
    // Buffers of different length throw rather than returning false
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-retell-signature") ?? "";

  const isValid = verifyRetellSignature(
    rawBody,
    process.env.RETELL_API_KEY!,
    signature
  );

  if (!isValid) {
    console.error("Retell webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
}
  // ... rest of the file stays exactly the same (JSON.parse, switch on event, etc.)
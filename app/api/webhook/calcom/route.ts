// app/api/webhook/calcom/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

function verifyCalcomSignature(rawBody: string, secret: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-cal-signature-256") ?? "";

  const settings = await getSettings();

  if (settings.calcomWebhookSecret) {
    const isValid = verifyCalcomSignature(rawBody, settings.calcomWebhookSecret, signature);
    if (!isValid) {
      console.error("Cal.com webhook: invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { triggerEvent, payload: booking } = payload;

  console.log(`Cal.com webhook: ${triggerEvent}`);

  if (triggerEvent === "BOOKING_CREATED") {
    const attendeeEmail = booking?.attendees?.[0]?.email;

    if (!attendeeEmail) {
      console.error("Cal.com webhook: no attendee email in payload");
      return NextResponse.json({ received: true });
    }

    // Match by prospect_email captured from the most recent call attempt for this lead
    const callAttempt = await prisma.callAttempt.findFirst({
      where: { prospectEmail: attendeeEmail },
      orderBy: { createdAt: "desc" },
      include: { lead: true },
    });

    if (!callAttempt) {
      console.error(`Cal.com webhook: no lead found for email ${attendeeEmail}`);
      return NextResponse.json({ received: true });
    }

    await prisma.lead.update({
      where: { id: callAttempt.leadId },
      data: {
        status: "BOOKED",
        // Optionally clear callbackAt/isSuppressed since they're now booked
        callbackAt: null,
      },
    });

    console.log(`Lead ${callAttempt.leadId} marked BOOKED via Cal.com webhook`);
  }

  return NextResponse.json({ received: true });
}
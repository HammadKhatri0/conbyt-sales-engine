// app/api/webhook/retell/route.ts
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

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, call } = payload;

  if (!call?.call_id) {
    return NextResponse.json({ error: "Missing call_id" }, { status: 400 });
  }

  console.log(`Retell webhook: ${event} for call ${call.call_id}`);

  try {
    switch (event) {
      case "call_started":
        // Nothing to persist yet — Lead already has retell_call_id from call initiation.
        break;

      case "call_ended":
        await handleCallEnded(call);
        break;

      case "call_analyzed":
        // Reserved for Stage 6 (OpenAI outcome classification + summary).
        // Retell's own call_analysis data could seed this, but we're doing our own
        // classification pass separately, so this event is a no-op for now.
        break;

      default:
        console.log(`Unhandled Retell event type: ${event}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Error processing ${event} for call ${call.call_id}:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleCallEnded(call: any) {
  const lead = await prisma.lead.findUnique({
    where: { retellCallId: call.call_id },
  });

  if (!lead) {
    console.error(`No lead found for retell_call_id ${call.call_id}`);
    return;
  }

  // Raw outcome mapping — placeholder until Stage 6 replaces this with
  // OpenAI classification against the transcript. Keeps the pipeline
  // functional in the meantime using Retell's own disconnection_reason.
  const outcome = mapDisconnectionReasonToStatus(call.disconnection_reason);

  await prisma.callAttempt.create({
    data: {
      leadId: lead.id,
      retellCallId: call.call_id,
      outcome,
      transcript: call.transcript ?? null,
      recordingUrl: call.recording_url ?? null,
      durationSeconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : null,
      disconnectionReason: call.disconnection_reason ?? null,
      rawPayload: call,
      startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
      endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: outcome },
  });
}

function mapDisconnectionReasonToStatus(
  reason: string | undefined
):
  | "BOOKED"
  | "NOT_INTERESTED"
  | "LINK_EMAILED"
  | "CALLBACK_REQUESTED"
  | "NO_ANSWER"
  | "WRONG_NUMBER" {
  switch (reason) {
    case "voicemail_reached":
      return "LINK_EMAILED";
    case "dial_no_answer":
    case "dial_busy":
      return "NO_ANSWER";
    case "dial_failed":
    case "invalid_destination":
      return "WRONG_NUMBER";
    default:
      // Anything else (user_hangup, agent_hangup, call_transfer, etc.)
      // gets classified properly in Stage 6 from the transcript instead.
      return "NOT_INTERESTED";
  }
}
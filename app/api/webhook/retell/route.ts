// app/api/webhook/retell/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { summarizeCall } from "@/lib/gemini";
import { continueCampaign } from "@/lib/campaign-engine";
import { sendBookingLinkEmail } from "@/lib/email";

const BOOKING_URL = process.env.BOOKING_URL!;

function verifyRetellSignature(
  rawBody: string,
  apiKey: string,
  signatureHeader: string
): boolean {
  const match = signatureHeader.match(/^v=(\d+),d=(.+)$/);
  if (!match) return false;

  const [, timestampStr, digest] = match;
  const timestamp = parseInt(timestampStr, 10);

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
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-retell-signature") ?? "";

  const isValid = verifyRetellSignature(rawBody, process.env.RETELL_API_KEY!, signature);

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
        break;

      case "call_ended":
        await handleCallEnded(call);
        break;

      case "call_analyzed":
        await handleCallAnalyzed(call);
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

type LeadOutcome =
  | "BOOKED"
  | "NOT_INTERESTED"
  | "LINK_EMAILED"
  | "CALLBACK_REQUESTED"
  | "NO_ANSWER"
  | "WRONG_NUMBER";

/**
 * call_ended fires as soon as the call finishes — before Retell's analysis is ready.
 * We save what we have immediately, apply a rough fallback status, and move the
 * campaign along right away so timing doesn't wait on analysis latency.
 */
async function handleCallEnded(call: any) {
  const lead = await prisma.lead.findUnique({
    where: { retellCallId: call.call_id },
  });

  if (!lead) {
    console.error(`No lead found for retell_call_id ${call.call_id}`);
    return;
  }

  const fallbackOutcome = mapDisconnectionReasonToStatus(call.disconnection_reason);

  await prisma.callAttempt.upsert({
    where: { retellCallId: call.call_id },
    create: {
      leadId: lead.id,
      retellCallId: call.call_id,
      outcome: fallbackOutcome,
      transcript: call.transcript ?? null,
      recordingUrl: call.recording_url ?? null,
      durationSeconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : null,
      disconnectionReason: call.disconnection_reason ?? null,
      rawPayload: call,
      startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
      endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
    },
    update: {
      transcript: call.transcript ?? null,
      recordingUrl: call.recording_url ?? null,
      durationSeconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : null,
      disconnectionReason: call.disconnection_reason ?? null,
      rawPayload: call,
      endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: fallbackOutcome },
  });

  // Move the campaign forward now — don't wait for call_analyzed, which can lag.
  if (lead.campaignId) {
    await continueCampaign(lead.campaignId);
  }
}

/**
 * call_analyzed fires once Retell's post-call analysis finishes. This is where
 * the real outcome and all the extracted booking/qualification data lives.
 */
async function handleCallAnalyzed(call: any) {
  // Temporary: log raw payload to confirm custom_analysis_data key names.
  // Works even without a matching Lead (e.g. dashboard web-call tests).
  console.log("call_analyzed raw payload:", JSON.stringify(call.call_analysis, null, 2));

  const lead = await prisma.lead.findUnique({
    where: { retellCallId: call.call_id },
  });

  if (!lead) {
    console.error(`No lead found for retell_call_id ${call.call_id} (call_analyzed)`);
    return;
  }

  const analysisData = call.call_analysis?.custom_analysis_data ?? {};

  const retellOutcome = (analysisData.outcome ?? "").toString().toUpperCase();
  const validOutcomes: LeadOutcome[] = [
    "BOOKED",
    "NOT_INTERESTED",
    "LINK_EMAILED",
    "CALLBACK_REQUESTED",
    "NO_ANSWER",
    "WRONG_NUMBER",
  ];
  const outcome: LeadOutcome = validOutcomes.includes(retellOutcome as LeadOutcome)
    ? (retellOutcome as LeadOutcome)
    : mapDisconnectionReasonToStatus(call.disconnection_reason);

  let summary: string | null = null;
  const transcript = call.transcript ?? "";
  if (transcript.trim().length > 0) {
    try {
      summary = await summarizeCall(transcript);
    } catch (err) {
      console.error("Gemini summary generation failed:", err);
    }
  }

  await prisma.callAttempt.upsert({
    where: { retellCallId: call.call_id },
    create: {
      leadId: lead.id,
      retellCallId: call.call_id,
      outcome,
      transcript: call.transcript ?? null,
      summary,
      recordingUrl: call.recording_url ?? null,
      durationSeconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : null,
      disconnectionReason: call.disconnection_reason ?? null,
      rawPayload: call,
      startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
      endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
      mainPainPoint: analysisData.main_pain_point ?? null,
      prospectEmail: analysisData.prospect_email ?? null,
      preferredTimes: analysisData.preferred_times ?? null,
      bookedDate: analysisData.booked_date ?? null,
      bookedDay: analysisData.booked_day ?? null,
      bookedTime: analysisData.booked_time ?? null,
      teamSize: analysisData.team_size ?? null,
    },
    update: {
      outcome,
      summary,
      mainPainPoint: analysisData.main_pain_point ?? null,
      prospectEmail: analysisData.prospect_email ?? null,
      preferredTimes: analysisData.preferred_times ?? null,
      bookedDate: analysisData.booked_date ?? null,
      bookedDay: analysisData.booked_day ?? null,
      bookedTime: analysisData.booked_time ?? null,
      teamSize: analysisData.team_size ?? null,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: outcome },
  });

  // If the prospect was interested but chose email follow-up over booking
  // live on the call, send them the booking link now.
  if (outcome === "LINK_EMAILED" && analysisData.prospect_email) {
    const emailResult = await sendBookingLinkEmail({
      to: analysisData.prospect_email,
      firstName: lead.name?.split(" ")[0] || "there",
      companyName: lead.company ?? null,
      bookingUrl: BOOKING_URL,
    });

    if (!emailResult.success) {
      console.error(
        `Failed to send booking link email for lead ${lead.id} (call ${call.call_id}):`,
        emailResult.error
      );
      // Not throwing — the call outcome itself is still valid even if the
      // email failed to send. Consider a retry/alerting mechanism later.
    }
  }
}

function mapDisconnectionReasonToStatus(reason: string | undefined): LeadOutcome {
  switch (reason) {
    case "voicemail_reached":
      // Voicemail detection is off, so this shouldn't fire in practice.
      // Falling back to NO_ANSWER rather than NOT_INTERESTED since no
      // real conversation happened.
      return "NO_ANSWER";
    case "dial_no_answer":
    case "dial_busy":
      return "NO_ANSWER";
    case "dial_failed":
    case "invalid_destination":
      return "WRONG_NUMBER";
    default:
      return "NOT_INTERESTED";
  }
}
// app/api/webhook/retell/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { summarizeCall } from "@/lib/gemini";
import { continueCampaign, RETRY_GAP_MS } from "@/lib/campaign-engine";
import { sendBookingLinkEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";

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

  const settings = await getSettings();

  if (!settings.retellApiKey) {
    console.error("Retell webhook: no API key configured in Settings");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const isValid = verifyRetellSignature(rawBody, settings.retellApiKey, signature);

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

  if (lead.campaignId) {
    await continueCampaign(lead.campaignId);
  }
}

async function handleCallAnalyzed(call: any) {
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

  const settings = await getSettings();
  let leadUpdateData: Record<string, any> = { status: outcome };

  if (outcome === "NOT_INTERESTED") {
    // Never dial this number again, in this campaign or any future one.
    leadUpdateData.isSuppressed = true;
  } else if (outcome === "WRONG_NUMBER") {
    // Take it out of the campaign so the dialer's campaignId-scoped query
    // stops considering it — distinct from suppression, which is reserved
    // for confirmed not-interested/do-not-call leads.
    leadUpdateData.campaignId = null;
  } else if (outcome === "NO_ANSWER") {
    const maxAttempts = settings.maxRetryAttempts ?? 3;
    const nextRetryCount = lead.retryCount + 1;

    if (nextRetryCount < maxAttempts) {
      // Re-enter the dial queue instead of sitting terminal; dialNextLead's
      // retryAt filter keeps it from being called again before the gap.
      leadUpdateData = {
        status: "QUEUED",
        retryCount: nextRetryCount,
        retryAt: new Date(Date.now() + RETRY_GAP_MS),
      };
    } else {
      // Attempts exhausted — leave status NO_ANSWER as terminal.
      leadUpdateData.retryCount = nextRetryCount;
      leadUpdateData.retryAt = null;
    }
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: leadUpdateData,
  });

  if (outcome === "LINK_EMAILED" && analysisData.prospect_email) {
    if (!settings.bookingUrl) {
      console.error("Cannot send booking link email: bookingUrl not set in Settings");
    } else {
      const emailResult = await sendBookingLinkEmail({
        to: analysisData.prospect_email,
        firstName: lead.name?.split(" ")[0] || "there",
        companyName: lead.company ?? null,
        bookingUrl: settings.bookingUrl,
      });

      if (!emailResult.success) {
        console.error(
          `Failed to send booking link email for lead ${lead.id} (call ${call.call_id}):`,
          emailResult.error
        );
      }
    }
  }
}

function mapDisconnectionReasonToStatus(reason: string | undefined): LeadOutcome {
  switch (reason) {
    case "voicemail_reached":
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
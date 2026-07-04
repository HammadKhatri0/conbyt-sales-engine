import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";

const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });

// Maps Retell's raw call_status onto four states the UI can show.
// Retell doesn't have a distinct "ringing" state on the call object —
// we treat "registered" (call created, not yet connected) as ringing.
function toDisplayStatus(
  callStatus: string
): "initiating" | "ringing" | "in_progress" | "ended" {
  switch (callStatus) {
    case "registered":
      return "ringing";
    case "ongoing":
      return "in_progress";
    case "ended":
    case "error":
      return "ended";
    default:
      return "initiating";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { call_id: string } }
) {
  const { call_id } = params;

  if (!call_id) {
    return NextResponse.json({ error: "call_id is required" }, { status: 400 });
  }

  try {
    // NOTE: verify this method name against your installed retell-sdk
    // version — some versions expose it as client.call.retrieve(call_id).
    const call = await client.call.retrieve(call_id);

    return NextResponse.json({
      call_id: call.call_id,
      raw_status: call.call_status,
      status: toDisplayStatus(call.call_status),
      disconnection_reason: call.disconnection_reason ?? null,
    });
  } catch (err) {
    console.error(`Failed to fetch call status for ${call_id}:`, err);
    return NextResponse.json(
      { error: "Failed to fetch call status" },
      { status: 502 }
    );
  }
}
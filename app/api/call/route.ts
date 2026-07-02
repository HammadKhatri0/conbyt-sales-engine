// app/api/call/route.ts
import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";

const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { name, phone } = await req.json();

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Name and phone number are required" },
        { status: 400 }
      );
    }

    // Basic E.164 check (e.g. +923001234567)
    const e164Regex = /^\+[1-9]\d{7,14}$/;
    if (!e164Regex.test(phone)) {
      return NextResponse.json(
        { error: "Phone number must be in international format, e.g. +923001234567" },
        { status: 400 }
      );
    }

    const call = await client.call.createPhoneCall({
      from_number: process.env.RETELL_FROM_NUMBER!,
      to_number: phone,
      override_agent_id: process.env.RETELL_AGENT_ID!,
      retell_llm_dynamic_variables: {
        customer_name: name,
      },
    });

    return NextResponse.json({ success: true, call_id: call.call_id });
  } catch (err) {
    console.error("Retell call error:", err);
    return NextResponse.json(
      { error: "Failed to place call" },
      { status: 500 }
    );
  }
}
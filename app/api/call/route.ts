// app/api/call/route.ts
import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";
import { prisma } from "@/lib/prisma";

const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { name, phone, company, industry, openerHook } = await req.json();

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Name and phone number are required" },
        { status: 400 }
      );
    }

    const e164Regex = /^\+[1-9]\d{7,14}$/;
    if (!e164Regex.test(phone)) {
      return NextResponse.json(
        { error: "Phone number must be in international format, e.g. +923001234567" },
        { status: 400 }
      );
    }

    // Reuse existing lead if this phone already exists (e.g. re-calling from Leads page),
    // otherwise create a fresh one.
    let lead = await prisma.lead.findUnique({ where: { phone } });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          name,
          phone,
          company: company ?? null,
          industry: industry ?? null,
          openerHook: openerHook ?? null,
          status: "CALLING",
        },
      });
    } else {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "CALLING" },
      });
    }

    const call = await client.call.createPhoneCall({
      from_number: process.env.RETELL_FROM_NUMBER!,
      to_number: phone,
      override_agent_id: process.env.RETELL_AGENT_ID!,
      retell_llm_dynamic_variables: {
        customer_name: name,
        first_name: name.split(" ")[0],
        company_name: company ?? "",
        industry: industry ?? "",
        opener_hook: openerHook ?? "",
      },
    });

    // Save retell_call_id immediately so the webhook can match this lead when call_ended fires.
    await prisma.lead.update({
      where: { id: lead.id },
      data: { retellCallId: call.call_id },
    });

    return NextResponse.json({ success: true, call_id: call.call_id, lead_id: lead.id });
  } catch (err) {
    console.error("Retell call error:", err);
    return NextResponse.json(
      { error: "Failed to place call" },
      { status: 500 }
    );
  }
}
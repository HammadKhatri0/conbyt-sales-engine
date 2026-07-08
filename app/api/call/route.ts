// app/api/call/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { placeCallForLead } from "@/lib/retell-call";

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

    // Reuse existing lead if this phone already exists, otherwise create a fresh one.
    let lead = await prisma.lead.findUnique({ where: { phone } });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          name,
          phone,
          company: company ?? null,
          industry: industry ?? null,
          openerHook: openerHook ?? null,
          status: "QUEUED",
        },
      });
    } else {
      // Update contact details in case they changed since last import/call
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          name,
          company: company ?? lead.company,
          industry: industry ?? lead.industry,
          openerHook: openerHook ?? lead.openerHook,
        },
      });
    }

    const result = await placeCallForLead(lead.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to place call" }, { status: 500 });
    }

    // Re-fetch to get the retell_call_id that placeCallForLead just saved
    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });

    return NextResponse.json({
      success: true,
      call_id: updatedLead?.retellCallId,
      lead_id: lead.id,
    });
  } catch (err) {
    console.error("Call initiation error:", err);
    return NextResponse.json({ error: "Failed to place call" }, { status: 500 });
  }
}
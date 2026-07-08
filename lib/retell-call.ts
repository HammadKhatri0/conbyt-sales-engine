// lib/retell-call.ts
import Retell from "retell-sdk";
import { prisma } from "@/lib/prisma";

const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });

export async function placeCallForLead(leadId: string): Promise<{ success: boolean; error?: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });

  if (!lead) {
    return { success: false, error: "Lead not found" };
  }

  try {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "CALLING" },
    });

    const call = await client.call.createPhoneCall({
      from_number: process.env.RETELL_FROM_NUMBER!,
      to_number: lead.phone,
      override_agent_id: process.env.RETELL_AGENT_ID!,
      retell_llm_dynamic_variables: {
        customer_name: lead.name,
        first_name: lead.name.split(" ")[0],
        company_name: lead.company ?? "",
        industry: lead.industry ?? "",
        opener_hook: lead.openerHook ?? "",
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { retellCallId: call.call_id },
    });

    return { success: true };
  } catch (err) {
    console.error(`Failed to place call for lead ${leadId}:`, err);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "QUEUED" }, // revert so it can be retried
    });
    return { success: false, error: "Failed to place call" };
  }
}
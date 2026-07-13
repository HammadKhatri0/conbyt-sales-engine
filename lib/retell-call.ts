// lib/retell-call.ts
import Retell from "retell-sdk";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export async function placeCallForLead(leadId: string): Promise<{ success: boolean; error?: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });

  if (!lead) {
    return { success: false, error: "Lead not found" };
  }

  const settings = await getSettings();

  if (!settings.retellApiKey || !settings.retellAgentId || !settings.retellFromNumber) {
    return { success: false, error: "Retell is not fully configured in Settings" };
  }

  const client = new Retell({ apiKey: settings.retellApiKey });

  try {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "CALLING" },
    });

    const call = await client.call.createPhoneCall({
      from_number: settings.retellFromNumber,
      to_number: lead.phone,
      override_agent_id: settings.retellAgentId,
      retell_llm_dynamic_variables: {
        customer_name: lead.name,
        first_name: lead.name.split(" ")[0],
        company_name: lead.company ?? "",
        industry: lead.industry ?? "",
        opener_hook: lead.briefOpenerHook || lead.openerHook || "",
        pain_assumption: lead.briefPainAssumption ?? "",
        relevant_proof_point: lead.briefProofPoint ?? "",
        personalised_pitch: lead.briefPersonalizedPitch ?? "",
        company_size_response: lead.employeeCount ? String(lead.employeeCount) : "",
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
      data: { status: "QUEUED" },
    });
    return { success: false, error: "Failed to place call" };
  }
}
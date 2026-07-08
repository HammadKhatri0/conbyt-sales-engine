// lib/campaign-engine.ts
import { prisma } from "@/lib/prisma";
import { placeCallForLead } from "@/lib/retell-call";
import { getTimezoneForPhone, isWithinCallableWindow } from "@/lib/timezone";

const RECHECK_DELAY_MS = 5 * 60 * 1000; // if no lead is callable right now, recheck in 5 min

/**
 * Called after a campaign is started, or after a call ends for a lead in a running campaign.
 * Waits the configured gap, then finds and dials the next eligible lead.
 */
export async function continueCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "RUNNING") {
    return; // paused or completed — do nothing
  }

  setTimeout(async () => {
    await dialNextLead(campaignId);
  }, campaign.gapSeconds * 1000);
}

async function dialNextLead(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "RUNNING") {
    return; // could have been paused during the gap wait
  }

  const queuedLeads = await prisma.lead.findMany({
    where: { campaignId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });

  if (queuedLeads.length === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED", currentLeadId: null },
    });
    console.log(`Campaign ${campaignId} completed — no more queued leads.`);
    return;
  }

  // Find the first lead that's within its local calling window right now
  const nextLead = queuedLeads.find((lead) => {
    const tz = getTimezoneForPhone(lead.phone);
    return isWithinCallableWindow(tz, campaign.callStartHour, campaign.callEndHour);
  });

  if (!nextLead) {
    console.log(`Campaign ${campaignId}: no leads currently within calling hours. Rechecking in 5 minutes.`);
    setTimeout(() => dialNextLead(campaignId), RECHECK_DELAY_MS);
    return;
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { currentLeadId: nextLead.id },
  });

  const result = await placeCallForLead(nextLead.id);

  if (!result.success) {
    console.error(`Campaign ${campaignId}: failed to call lead ${nextLead.id}, skipping to next after gap.`);
    // Treat as ended immediately so the chain continues rather than stalling
    await continueCampaign(campaignId);
  }
  // If successful, the chain continues from the webhook's call_ended handler,
  // which calls continueCampaign() again once this call finishes.
}

/**
 * Starts a campaign: assigns leads, sets status RUNNING, dials the first lead.
 */
export async function startCampaign(campaignId: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING" },
  });
  await dialNextLead(campaignId);
}

export async function pauseCampaign(campaignId: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  });
}

export async function resumeCampaign(campaignId: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING" },
  });
  await dialNextLead(campaignId); // continue immediately, don't wait for a gap on resume
}
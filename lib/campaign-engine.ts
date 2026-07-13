// lib/campaign-engine.ts
import { prisma } from "@/lib/prisma";
import { placeCallForLead } from "@/lib/retell-call";
import { getTimezoneForPhone, isWithinCallableWindow } from "@/lib/timezone";
import { getActiveICPProfile } from "@/lib/icp";
import { getSettings } from "@/lib/settings";
import { generateOutboundEmail } from "@/lib/email-generation";
import { sendGmailEmail } from "@/lib/gmail";

const RECHECK_DELAY_MS = 5 * 60 * 1000; // if no lead is callable right now, recheck in 5 min
const EMAIL_RECHECK_DELAY_MS = 5 * 60 * 1000; // if the email loop is blocked (window/rate limit), recheck in 5 min
export const RETRY_GAP_MS = 30 * 60 * 1000; // gap before a NO_ANSWER lead is eligible to be redialed

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

  const activeProfile = await getActiveICPProfile();
  const scoreFilter = activeProfile
    ? { NOT: { finalScore: { not: null, lt: activeProfile.minScoreThreshold } } }
    : {};

  // Raw count, ignoring timing gates (retryAt backoff, email-wait) — used only
  // to decide whether the campaign is truly finished vs just waiting on a
  // timer. Using the timing-filtered set for this (as before) meant a
  // campaign with only not-yet-due leads marked itself COMPLETED immediately
  // instead of rechecking later.
  const remainingCount = await prisma.lead.count({
    where: { campaignId, status: "QUEUED", isSuppressed: false, ...scoreFilter },
  });

  if (remainingCount === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED", currentLeadId: null },
    });
    console.log(`Campaign ${campaignId} completed — no more queued leads.`);
    return;
  }

  const queuedLeads = await prisma.lead.findMany({
    where: {
      campaignId,
      status: "QUEUED",
      isSuppressed: false,
      // A lead re-queued after a NO_ANSWER retry carries a future retryAt —
      // exclude it from dialing until that gap has passed.
      OR: [{ retryAt: null }, { retryAt: { lte: new Date() } }],
      // Combined (email-then-call) campaigns: a lead isn't callable until
      // it's been emailed AND the configured wait has elapsed. Leads that
      // haven't been emailed yet (emailSentAt null) are excluded entirely —
      // emailNextLead() is responsible for them.
      ...(campaign.emailBeforeCall
        ? { emailSentAt: { not: null, lte: new Date(Date.now() - campaign.emailWaitHours * 60 * 60 * 1000) } }
        : {}),
      ...scoreFilter,
    },
    orderBy: { createdAt: "asc" },
  });

  if (queuedLeads.length === 0) {
    console.log(`Campaign ${campaignId}: no leads currently callable (waiting on retry/email timers). Rechecking in 5 minutes.`);
    setTimeout(() => dialNextLead(campaignId), RECHECK_DELAY_MS);
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
 * Email-sending loop for combined (email-then-call) campaigns — mirrors
 * dialNextLead's gap/window pattern but for outbound emails. Sends one
 * AI-generated email per pass, respecting Settings' email send window,
 * daily cap, and gap, then reschedules itself. Once every lead has been
 * emailed, this loop naturally has nothing left to do — dialNextLead (or
 * the retry-check sweep) picks leads up again once their wait elapses.
 */
async function emailNextLead(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "RUNNING" || !campaign.emailBeforeCall) {
    return;
  }

  const activeProfile = await getActiveICPProfile();

  const candidates = await prisma.lead.findMany({
    where: {
      campaignId,
      status: "QUEUED",
      isSuppressed: false,
      emailSentAt: null,
      email: { not: null },
      ...(activeProfile
        ? { NOT: { finalScore: { not: null, lt: activeProfile.minScoreThreshold } } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length === 0) {
    console.log(`Campaign ${campaignId}: every lead has been emailed — handing off to the call-side wait/dial cycle.`);
    return;
  }

  if (!activeProfile) {
    console.log(`Campaign ${campaignId}: no active ICP profile — can't generate emails yet. Rechecking in 5 minutes.`);
    setTimeout(() => emailNextLead(campaignId), EMAIL_RECHECK_DELAY_MS);
    return;
  }

  const settings = await getSettings();
  const startHour = settings.emailSendStartHour ?? 9;
  const endHour = settings.emailSendEndHour ?? 18;
  const currentHour = new Date().getHours();

  if (currentHour < startHour || currentHour >= endHour) {
    console.log(`Campaign ${campaignId}: outside the email send window (${startHour}-${endHour}). Rechecking in 5 minutes.`);
    setTimeout(() => emailNextLead(campaignId), EMAIL_RECHECK_DELAY_MS);
    return;
  }

  const maxPerDay = settings.maxEmailsPerDay ?? 100;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await prisma.lead.count({ where: { emailSentAt: { gte: startOfDay } } });

  if (sentToday >= maxPerDay) {
    console.log(`Campaign ${campaignId}: daily email limit reached (${maxPerDay}). Rechecking in 5 minutes.`);
    setTimeout(() => emailNextLead(campaignId), EMAIL_RECHECK_DELAY_MS);
    return;
  }

  const lead = candidates[0];
  if (lead.email) {
    try {
      const generated = await generateOutboundEmail(lead, activeProfile);
      if (!generated) {
        console.error(`Campaign ${campaignId}: failed to generate email for lead ${lead.id}`);
      } else {
        const result = await sendGmailEmail({ to: lead.email, subject: generated.subject, body: generated.body });
        if (result.success) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              emailSubject: generated.subject,
              emailBody: generated.body,
              emailGeneratedAt: new Date(),
              emailSentAt: new Date(),
            },
          });
        } else {
          console.error(`Campaign ${campaignId}: failed to send email to lead ${lead.id}: ${result.error}`);
        }
      }
    } catch (err) {
      console.error(`Campaign ${campaignId}: error emailing lead ${lead.id}:`, err);
    }
  }

  // Continue regardless of this lead's outcome, so one failure doesn't stall
  // the whole sequence — it'll fall through to the call-only path once its
  // wait would-have-elapsed since emailSentAt stays null for it.
  setTimeout(() => emailNextLead(campaignId), (settings.emailGapSeconds ?? 10) * 1000);
}

/**
 * Starts a campaign: assigns leads, sets status RUNNING, dials the first lead.
 * For combined (email-then-call) campaigns, also kicks off the email loop —
 * dialNextLead's own timing filter keeps it from calling anyone until their
 * wait has elapsed, so it's safe to start both loops together.
 */
export async function startCampaign(campaignId: string) {
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING" },
  });
  if (campaign.emailBeforeCall) {
    await emailNextLead(campaignId);
  }
  await dialNextLead(campaignId);
}

export async function pauseCampaign(campaignId: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  });
}

export async function resumeCampaign(campaignId: string) {
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING" },
  });
  // emailNextLead() is a no-op if every lead's already been emailed, so it's
  // safe to always call it here rather than track whether the email phase
  // was already finished before the pause.
  if (campaign.emailBeforeCall) {
    await emailNextLead(campaignId);
  }
  await dialNextLead(campaignId); // continue immediately, don't wait for a gap on resume
}

/**
 * A campaign marks itself COMPLETED once dialNextLead finds no immediately
 * callable QUEUED lead. But a lead re-queued after a NO_ANSWER carries a
 * future retryAt, so it doesn't count as callable yet — and once the
 * campaign is COMPLETED, nothing will ever re-check it on its own. This is
 * run periodically (see workers/retry.ts) to reactivate any COMPLETED
 * campaign whose retry leads have since come due.
 *
 * RUNNING campaigns aren't touched here — they re-run this same query on
 * every dial cycle already, so due retries surface naturally.
 */
export async function reactivateCampaignsWithDueRetries() {
  const dueLeads = await prisma.lead.findMany({
    where: {
      status: "QUEUED",
      isSuppressed: false,
      retryAt: { lte: new Date() },
      campaignId: { not: null },
    },
    select: { campaignId: true },
    distinct: ["campaignId"],
  });

  for (const { campaignId } of dueLeads) {
    if (!campaignId) continue;
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (campaign?.status === "COMPLETED") {
      console.log(`Reactivating campaign ${campaignId} — retry leads are now due.`);
      await resumeCampaign(campaignId);
    }
  }
}

/**
 * Resilience net for combined campaigns: dialNextLead's local 5-minute
 * recheck loop handles the common case of "waiting on an email-wait timer"
 * on its own, but that in-memory setTimeout chain doesn't survive a worker
 * restart. This periodic sweep (see workers/retry.ts) catches any combined
 * campaign that's stuck — RUNNING with a dead recheck loop, or COMPLETED
 * because dialNextLead ran before this fix shipped — and has leads whose
 * email-wait has since elapsed.
 */
export async function reactivateCombinedCampaigns() {
  const campaigns = await prisma.campaign.findMany({
    where: { emailBeforeCall: true, status: { in: ["RUNNING", "COMPLETED"] } },
  });

  for (const campaign of campaigns) {
    const dueCount = await prisma.lead.count({
      where: {
        campaignId: campaign.id,
        status: "QUEUED",
        isSuppressed: false,
        emailSentAt: { not: null, lte: new Date(Date.now() - campaign.emailWaitHours * 60 * 60 * 1000) },
      },
    });

    if (dueCount === 0) continue;

    console.log(`Campaign ${campaign.id}: ${dueCount} lead(s) past their email-wait — nudging the dial loop.`);
    if (campaign.status === "COMPLETED") {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "RUNNING" } });
    }
    await dialNextLead(campaign.id);
  }
}

/**
 * Places a call for any lead whose callbackAt has come due, independent of
 * campaign dialing/gap logic — a scheduled callback is a one-off, not part
 * of a campaign's sequential queue. Run periodically alongside the retry
 * sweep (see workers/retry.ts).
 */
export async function triggerDueCallbacks() {
  const dueLeads = await prisma.lead.findMany({
    where: {
      callbackAt: { lte: new Date() },
      isSuppressed: false,
      status: { not: "CALLING" },
    },
  });

  for (const lead of dueLeads) {
    console.log(`Triggering scheduled callback for lead ${lead.id}`);
    // Clear callbackAt first so a slow call (or a failed placeCallForLead)
    // can't cause the next sweep to fire the same callback again.
    await prisma.lead.update({ where: { id: lead.id }, data: { callbackAt: null } });

    const result = await placeCallForLead(lead.id);
    if (!result.success) {
      console.error(`Callback call failed for lead ${lead.id}: ${result.error}`);
    }
  }
}
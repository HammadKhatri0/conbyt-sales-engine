// workers/call-brief.ts
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { generateCallBrief } from "../lib/call-brief";
import { getActiveICPProfile } from "../lib/icp";

export const callBriefWorker = new Worker(
  "call-brief",
  async (job) => {
    const { leadId } = job.data as { leadId: string };

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const icp = await getActiveICPProfile();
    if (!icp) {
      console.log(`No active ICP profile — skipping call brief for lead ${leadId}`);
      return { skipped: true };
    }

    const brief = await generateCallBrief(lead, icp);
    if (!brief) {
      throw new Error(`Failed to generate call brief for lead ${leadId}`);
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        briefOpenerHook: brief.openerHook,
        briefPainAssumption: brief.painAssumption,
        briefProofPoint: brief.proofPoint,
        briefPersonalizedPitch: brief.personalizedPitch,
        briefGeneratedAt: new Date(),
      },
    });

    return { success: true };
  },
  { connection: redisConnection as any, concurrency: 5 }
);

callBriefWorker.on("completed", (job) => {
  console.log(`✅ Call brief generated for lead ${job.data.leadId}`);
});

callBriefWorker.on("failed", (job, err) => {
  console.error(`❌ Call brief generation failed for lead ${job?.data.leadId}:`, err.message);
});
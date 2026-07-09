// workers/enrichment.ts
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { researchWebsite } from "../lib/enrichment/website";
import { researchCompanyNews } from "../lib/enrichment/news";
import { scoringQueue } from "../lib/queues";

export const enrichmentWorker = new Worker(
  "enrichment",
  async (job) => {
    const { leadId } = job.data as { leadId: string };

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { enrichmentStatus: "ENRICHING" },
    });

    try {
      const [websiteSummary, newsSummary] = await Promise.all([
        lead.website ? researchWebsite(lead.website) : Promise.resolve(null),
        lead.company ? researchCompanyNews(lead.company) : Promise.resolve(null),
      ]);

      const techStack = [
        ...(websiteSummary?.techStackMentioned ?? []),
        ...(websiteSummary?.softwareToolsMentioned ?? []),
      ];

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          websiteSummary: websiteSummary as any,
          newsSummary: newsSummary as any,
          techStackDetected: techStack,
          enrichmentStatus: "READY",
          enrichedAt: new Date(),
        },
      });

      await scoringQueue.add("score-lead", { leadId });

      return { success: true };
    } catch (err) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { enrichmentStatus: "FAILED" },
      });
      throw err;
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

enrichmentWorker.on("completed", (job) => {
  console.log(`✅ Enrichment completed for lead ${job.data.leadId}`);
});

enrichmentWorker.on("failed", (job, err) => {
  console.error(`❌ Enrichment failed for lead ${job?.data.leadId}:`, err.message);
});
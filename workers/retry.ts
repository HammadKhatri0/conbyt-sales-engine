// workers/retry.ts
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { retryQueue } from "../lib/queues";
import { reactivateCampaignsWithDueRetries, triggerDueCallbacks, reactivateCombinedCampaigns } from "../lib/campaign-engine";

const SWEEP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes — matches Lead.retryAt granularity

// Schedule the recurring sweep. Safe to call on every worker boot — BullMQ
// dedupes repeatable jobs that share the same jobId + repeat options rather
// than stacking up duplicates.
retryQueue.add(
  "sweep",
  {},
  { repeat: { every: SWEEP_INTERVAL_MS }, jobId: "campaign-retry-sweep" }
);

export const retryWorker = new Worker(
  "retry-check",
  async () => {
    await reactivateCampaignsWithDueRetries();
    await reactivateCombinedCampaigns();
    await triggerDueCallbacks();
    return { success: true };
  },
  { connection: redisConnection as any, concurrency: 1 }
);

retryWorker.on("completed", () => {
  console.log("✅ Retry/callback sweep completed");
});

retryWorker.on("failed", (job, err) => {
  console.error("❌ Retry/callback sweep failed:", err.message);
});

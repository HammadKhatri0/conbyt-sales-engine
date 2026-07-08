// lib/queues.ts
import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const enrichmentQueue = new Queue("enrichment", { connection: redisConnection as any });
export const scoringQueue = new Queue("scoring", { connection: redisConnection as any });
export const briefQueue = new Queue("call-brief", { connection: redisConnection as any });
export const emailGenerationQueue = new Queue("email-generation", { connection: redisConnection as any });
export const retryQueue = new Queue("retry-check", { connection: redisConnection as any });
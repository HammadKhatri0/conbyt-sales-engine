// app/api/test-queue/route.ts
import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

const testQueue = new Queue("test-queue", { connection: redisConnection as any});

export async function GET() {
  const job = await testQueue.add("test-job", { message: "Hello from BullMQ", timestamp: Date.now() });
  return NextResponse.json({ success: true, jobId: job.id });
}
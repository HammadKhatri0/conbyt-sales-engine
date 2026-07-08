// lib/redis.ts
import IORedis from "ioredis";

const globalForRedis = global as unknown as { redis: IORedis };

export const redisConnection =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // required by BullMQ
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redisConnection;
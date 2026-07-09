// lib/icp.ts
import { prisma } from "@/lib/prisma";

export async function getActiveICPProfile() {
  return prisma.iCPProfile.findFirst({ where: { isActive: true } });
}
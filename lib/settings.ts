// lib/settings.ts
import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });

  if (!settings) {
    settings = await prisma.settings.create({ data: { id: SETTINGS_ID } });
  }

  return settings;
}

export async function updateSettings(data: Record<string, any>) {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
}
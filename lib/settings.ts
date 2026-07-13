// lib/settings.ts
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const SETTINGS_ID = "singleton";

// Rotatable credentials — encrypted at rest in the DB, decrypted transparently
// on read. This is the single source of truth for which Settings fields are
// secrets; app/api/settings/route.ts reuses this list for response masking.
export const SENSITIVE_SETTINGS_FIELDS = [
  "retellApiKey",
  "geminiApiKey",
  "resendApiKey",
  "apolloApiKey",
  "proxycurlApiKey",
  "openaiApiKey",
  "twilioAuthToken",
  "calcomApiKey",
  "calcomWebhookSecret",
  "gmailClientSecret",
  "gmailRefreshToken",
] as const;

function decryptSettings<T extends Record<string, any>>(settings: T): T {
  const result = { ...settings };
  for (const field of SENSITIVE_SETTINGS_FIELDS) {
    if (result[field] != null) {
      (result as any)[field] = decryptSecret(result[field] as string);
    }
  }
  return result;
}

function encryptSettingsInput(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  for (const field of SENSITIVE_SETTINGS_FIELDS) {
    if (result[field] != null) {
      result[field] = encryptSecret(result[field] as string);
    }
  }
  return result;
}

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });

  if (!settings) {
    settings = await prisma.settings.create({ data: { id: SETTINGS_ID } });
  }

  return decryptSettings(settings);
}

export async function updateSettings(data: Record<string, any>) {
  const encrypted = encryptSettingsInput(data);
  const updated = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...encrypted },
    update: encrypted,
  });
  return decryptSettings(updated);
}

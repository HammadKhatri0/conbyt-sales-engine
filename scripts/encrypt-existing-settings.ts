// scripts/encrypt-existing-settings.ts
//
// One-time migration: encrypts any plaintext secrets already sitting in the
// Settings table (values saved before lib/settings.ts started encrypting on
// write). Safe to re-run — encryptSecret() no-ops on values that are already
// encrypted, so nothing gets double-encrypted.
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { encryptSecret, isEncrypted } = await import("../lib/crypto");
  const { SENSITIVE_SETTINGS_FIELDS } = await import("../lib/settings");

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    console.log("No settings row found — nothing to encrypt.");
    return;
  }

  const updates: Record<string, string> = {};
  for (const field of SENSITIVE_SETTINGS_FIELDS) {
    const value = (settings as any)[field] as string | null;
    if (value && !isEncrypted(value)) {
      updates[field] = encryptSecret(value) as string;
    }
  }

  const fieldsToUpdate = Object.keys(updates);
  if (fieldsToUpdate.length === 0) {
    console.log("All secrets already encrypted — nothing to do.");
    return;
  }

  await prisma.settings.update({ where: { id: "singleton" }, data: updates });
  console.log(`Encrypted ${fieldsToUpdate.length} field(s): ${fieldsToUpdate.join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

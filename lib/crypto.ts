// lib/crypto.ts
//
// AES-256-GCM encryption for secrets stored at rest (e.g. the Settings
// table). Ciphertext is tagged with a version prefix so plaintext values
// written before this was introduced can still be read (and get
// transparently re-encrypted the next time they're saved).

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:v1:";
const IV_LENGTH = 12; // recommended for GCM

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"` " +
        "and add it to your .env.local."
    );
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY must be a 32-byte key encoded as a 64-character hex string."
    );
  }

  cachedKey = key;
  return key;
}

/** True if a value is already in our encrypted format. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

/** Encrypts a plaintext string. Returns the value unchanged if null/empty. */
export function encryptSecret(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === "") return value;
  if (isEncrypted(value)) return value; // already encrypted, don't double-wrap

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return (
    ENC_PREFIX +
    [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":")
  );
}

/**
 * Decrypts a value produced by encryptSecret. Values that aren't in our
 * encrypted format are returned as-is (legacy plaintext, migrated lazily).
 */
export function decryptSecret(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === "") return value;
  if (!isEncrypted(value)) return value; // legacy plaintext

  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = value.slice(ENC_PREFIX.length).split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted value in Settings table.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

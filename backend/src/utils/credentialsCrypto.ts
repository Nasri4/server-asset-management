import crypto from "crypto";

const ALGO = "aes-256-gcm" as const;
const IV_LEN = 12;
const TAG_LEN = 16;

function decodeKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be base64 for 32 bytes (256-bit). Example (Linux/macOS): `openssl rand -base64 32`"
    );
  }
  return key;
}

/**
 * Encrypts a secret using AES-256-GCM.
 * Returns a base64 string containing: iv(12) + tag(16) + ciphertext.
 */
export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(payloadBase64: string, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const payload = Buffer.from(payloadBase64, "base64");

  if (payload.length <= IV_LEN + TAG_LEN) {
    throw new Error("Invalid encrypted payload");
  }

  const iv = payload.subarray(0, IV_LEN);
  const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = payload.subarray(IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return plaintext;
}

export function generateEncryptionKeyBase64(): string {
  return crypto.randomBytes(32).toString("base64");
}

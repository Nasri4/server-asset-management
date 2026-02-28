const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function decodeKey(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    const fromHex = Buffer.from(trimmed, 'hex');
    if (fromHex.length === 32) return fromHex;
  }

  try {
    const fromB64 = Buffer.from(trimmed, 'base64');
    if (fromB64.length === 32) return fromB64;
  } catch {
    return null;
  }

  return null;
}

function getKeys() {
  const keys = [];
  const keyV1 = decodeKey(process.env.ENCRYPTION_KEY_V1);
  const keyV2 = decodeKey(process.env.ENCRYPTION_KEY_V2);

  if (keyV1) keys.push({ version: 'v1', key: keyV1 });
  if (keyV2) keys.push({ version: 'v2', key: keyV2 });

  return keys;
}

function getPrimaryKey() {
  const keyV2 = decodeKey(process.env.ENCRYPTION_KEY_V2);
  if (keyV2) return { version: 'v2', key: keyV2 };

  const keyV1 = decodeKey(process.env.ENCRYPTION_KEY_V1);
  if (keyV1) return { version: 'v1', key: keyV1 };

  throw new Error('Encryption keys are not configured correctly. Provide ENCRYPTION_KEY_V1 or ENCRYPTION_KEY_V2 as 32-byte hex/base64.');
}

function normalizeBase64(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Invalid encrypted payload.');
  }
  return value.trim();
}

function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) {
    return null;
  }

  const primary = getPrimaryKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, primary.key, iv);

  const input = typeof plaintext === 'string' ? plaintext : String(plaintext);
  const ciphertext = Buffer.concat([cipher.update(input, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion: primary.version,
  };
}

function tryDecryptWithKey(key, payload) {
  const iv = Buffer.from(normalizeBase64(payload.iv), 'base64');
  const authTag = Buffer.from(normalizeBase64(payload.authTag), 'base64');
  const ciphertext = Buffer.from(normalizeBase64(payload.ciphertext), 'base64');

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES || !ciphertext.length) {
    throw new Error('Invalid encrypted payload.');
  }

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

function decrypt(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (!payload.ciphertext || !payload.iv || !payload.authTag) {
    return null;
  }

  const keys = getKeys();
  if (!keys.length) {
    throw new Error('Encryption keys are not configured correctly.');
  }

  const ordered = [];
  if (payload.keyVersion) {
    const match = keys.find((entry) => entry.version === payload.keyVersion);
    if (match) ordered.push(match);
  }
  for (const entry of keys) {
    if (!ordered.some((candidate) => candidate.version === entry.version)) {
      ordered.push(entry);
    }
  }

  for (const entry of ordered) {
    try {
      return tryDecryptWithKey(entry.key, payload);
    } catch {
      // Try next key version
    }
  }

  throw new Error('Unable to decrypt payload.');
}

module.exports = {
  encrypt,
  decrypt,
};

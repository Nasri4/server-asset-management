const encryptionService = require('../services/encryption.service');

function serializeEncryptedPayload(payload) {
  return `enc:${payload.keyVersion}:${payload.iv}:${payload.authTag}:${payload.ciphertext}`;
}

function parseEncryptedPayload(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('enc:')) return null;

  const parts = value.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted payload format.');
  }

  const [, keyVersion, iv, authTag, ciphertext] = parts;
  if (!keyVersion || !iv || !authTag || !ciphertext) {
    throw new Error('Invalid encrypted payload format.');
  }

  return { keyVersion, iv, authTag, ciphertext };
}

function encrypt(text) {
  if (text === null || text === undefined || text === '') return null;
  const payload = encryptionService.encrypt(String(text));
  return serializeEncryptedPayload(payload);
}

function decrypt(cipherText) {
  if (!cipherText) return null;

  if (typeof cipherText !== 'string') {
    throw new Error('Invalid encrypted value type.');
  }

  const parsed = parseEncryptedPayload(cipherText);
  if (!parsed) {
    return cipherText;
  }

  return encryptionService.decrypt(parsed);
}

module.exports = { encrypt, decrypt };

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce recommended for GCM
const VERSION = 'v1';

/**
 * Encrypts a UTF-8 string with AES-256-GCM using a per-value random IV.
 * Output format: `v1:<ivB64>:<authTagB64>:<ciphertextB64>`
 *
 * The authentication tag guarantees integrity: tampered ciphertext will fail
 * to decrypt rather than silently returning wrong data.
 */
export function encryptSecret(plaintext: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/** Decrypts a value produced by {@link encryptSecret}. */
export function decryptSecret(payload: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes');
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted payload');
  }
  const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Constant-time comparison to avoid timing side channels. */
export function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

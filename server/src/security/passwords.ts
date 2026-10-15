import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

// scrypt parameters. N must be a power of two. 2^15 balances security and
// latency on modest hardware. Stored per-hash so parameters can be upgraded
// over time without invalidating existing passwords.
const N = 1 << 15;
const r = 8;
const p = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

/**
 * Hashes a password with scrypt (memory-hard, built into Node, no native deps).
 * Format: `scrypt$N$r$p$<saltB64>$<hashB64>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = (await scryptAsync(password, salt, KEY_LEN, {
    N,
    r,
    p,
    maxmem: 256 * 1024 * 1024,
  })) as Buffer;
  return [
    'scrypt',
    N,
    r,
    p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/** Verifies a password against a stored scrypt hash in constant time. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const rValue = Number(parts[2]);
  const pValue = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(rValue) || !Number.isInteger(pValue)) {
    return false;
  }
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');

  const derived = (await scryptAsync(password, salt, expected.length, {
    N: n,
    r: rValue,
    p: pValue,
    maxmem: 256 * 1024 * 1024,
  })) as Buffer;

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

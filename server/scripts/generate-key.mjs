// Generates the two secrets required by the server: JWT_SECRET and MASTER_KEY.
// Usage: npm run genkey
import { randomBytes } from 'node:crypto';

const jwtSecret = randomBytes(48).toString('base64url');
const masterKey = randomBytes(32).toString('base64');

console.log('\nAdd these lines to server/.env:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`MASTER_KEY=${masterKey}`);
console.log('\nKeep MASTER_KEY safe: if you lose it, stored cloud credentials cannot be decrypted.\n');

import { z } from 'zod';
import { resolve } from 'node:path';

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATA_DIR: z.string().default('./data'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  MASTER_KEY: z.string().refine((v) => {
    try {
      return Buffer.from(v, 'base64').length === 32;
    } catch {
      return false;
    }
  }, 'MASTER_KEY must be a base64-encoded 32-byte value (run `npm run genkey`)'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: boolFromString,
  SCANNER_PATH: z.string().default('../cloudsploit/index.js'),
  SCANNER_TIMEOUT_MS: z.coerce.number().int().positive().default(600_000),
  WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(3_000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(4).default(1),
});

export type AppConfig = {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  dataDir: string;
  dbPath: string;
  jwtSecret: string;
  masterKey: Buffer;
  corsOrigin: string;
  cookieSecure: boolean;
  scannerPath: string;
  scannerTimeoutMs: number;
  workerIntervalMs: number;
  workerConcurrency: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${details}\n\n` +
        'Copy server/.env.example to server/.env and run `npm run genkey` to fill in the secrets.',
    );
  }

  const dataDir = resolve(process.cwd(), parsed.data.DATA_DIR);

  return {
    env: parsed.data.NODE_ENV,
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    dataDir,
    dbPath: resolve(dataDir, 'cloudsploit.sqlite'),
    jwtSecret: parsed.data.JWT_SECRET,
    masterKey: Buffer.from(parsed.data.MASTER_KEY, 'base64'),
    corsOrigin: parsed.data.CORS_ORIGIN,
    cookieSecure: parsed.data.COOKIE_SECURE,
    scannerPath: resolve(process.cwd(), parsed.data.SCANNER_PATH),
    scannerTimeoutMs: parsed.data.SCANNER_TIMEOUT_MS,
    workerIntervalMs: parsed.data.WORKER_INTERVAL_MS,
    workerConcurrency: parsed.data.WORKER_CONCURRENCY,
  };
}

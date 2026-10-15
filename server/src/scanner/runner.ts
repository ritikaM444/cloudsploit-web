import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Provider, ProviderCredentials, ScannerResult, ScanOptions } from '../types.ts';

export interface ScanRunInput {
  provider: Provider;
  credentials: ProviderCredentials;
  options: ScanOptions;
  scannerPath: string;
  timeoutMs: number;
  /** Directory to place transient files in. Defaults to OS temp. */
  workDir?: string;
}

export interface ScanRunOutput {
  results: ScannerResult[];
  log: string;
  exitCode: number | null;
}

/** Minimal config skeleton required by cloudsploit/index.js (it reads every provider key). */
function buildConfig(
  provider: Provider,
  credentials: ProviderCredentials,
): Record<string, unknown> {
  return {
    credentials: {
      alibaba: {},
      aws: {},
      azure: {},
      oracle: {},
      github: {},
      google: {},
      [provider]: credentials,
    },
  };
}

/**
 * Runs a CloudSploit scan by invoking the existing CLI as a child process with
 * `--json` output, then parsing the emitted results. Running it out-of-process
 * keeps the long, blocking scan away from the API event loop.
 */
export async function runScan(input: ScanRunInput): Promise<ScanRunOutput> {
  const base = input.workDir ?? tmpdir();
  const workDir = await mkdtemp(join(base, 'cs-scan-'));
  const configPath = join(workDir, 'config.json');
  const outputPath = join(workDir, 'results.json');

  // Restrict permissions as far as the platform allows (credentials are written here).
  await writeFile(configPath, JSON.stringify(buildConfig(input.provider, input.credentials)), {
    mode: 0o600,
  });

  const args = [
    input.scannerPath,
    `--cloud=${input.provider}`,
    `--config=${configPath}`,
    `--json=${outputPath}`,
    '--console=none',
  ];
  if (input.options.plugin) args.push(`--plugin=${input.options.plugin}`);
  for (const c of input.options.compliance ?? []) args.push(`--compliance=${c}`);

  try {
    const { log, exitCode } = await runProcess(args, input.timeoutMs);
    let results: ScannerResult[] = [];
    try {
      const raw = await readFile(outputPath, 'utf8');
      const trimmed = raw.trim();
      if (trimmed.length) results = JSON.parse(trimmed) as ScannerResult[];
    } catch {
      // No/invalid output file: treat as a failed scan (log carries the reason).
      return { results: [], log, exitCode };
    }
    return { results, log, exitCode };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function runProcess(
  args: string[],
  timeoutMs: number,
): Promise<{ log: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let log = '';
    const append = (chunk: Buffer) => {
      log += chunk.toString('utf8');
      // Cap retained log size to avoid unbounded memory for chatty scans.
      if (log.length > 200_000) log = log.slice(-200_000);
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    const timer = setTimeout(() => {
      append(Buffer.from(`\n[runner] Scan exceeded timeout of ${timeoutMs}ms; terminating.`));
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ log: log + `\n[runner] Failed to start scanner: ${err.message}`, exitCode: null });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ log, exitCode: code });
    });
  });
}

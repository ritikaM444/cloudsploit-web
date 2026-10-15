import { decryptSecret } from '../security/crypto.ts';
import { runScan } from '../scanner/runner.ts';
import { getPluginMeta } from '../scanner/pluginMeta.ts';
import type { Store } from '../db/index.ts';
import type { AppConfig } from '../config.ts';
import type { Provider, ProviderCredentials, ScanOptions, ScannerResult } from '../types.ts';

export type Logger = {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

function tally(results: ScannerResult[]) {
  let fail = 0;
  let warn = 0;
  for (const r of results) {
    if (r.status === 'FAIL') fail += 1;
    else if (r.status === 'WARN') warn += 1;
  }
  return { result: results.length, fail, warn };
}

export class ScanWorker {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly store: Store,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.config.workerIntervalMs);
    // Do not keep the process alive solely for the worker timer.
    this.timer.unref?.();
    void this.tick();
    this.logger.info({ intervalMs: this.config.workerIntervalMs }, 'scan worker started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const scan = this.store.claimNextQueuedScan();
      if (scan) await this.process(scan.id);
    } catch (err) {
      this.logger.error({ err }, 'worker tick failed');
    } finally {
      this.busy = false;
    }
  }

  private async process(scanId: string): Promise<void> {
    // claimNextQueuedScan already marked it running.
    const scan = this.store.db
      .prepare('SELECT * FROM scans WHERE id = ?')
      .get(scanId) as { id: string; account_id: string; provider: string; options: string } | undefined;
    if (!scan) return;

    const account = this.store.getAccountById(scan.account_id);
    if (!account) {
      this.store.finishScan(scanId, 'failed', { result: 0, fail: 0, warn: 0 }, 'Account no longer exists');
      return;
    }

    const startedAt = Date.now();
    this.logger.info({ scanId, accountId: account.id }, 'starting scan');

    try {
      const credentials = JSON.parse(
        decryptSecret(account.credential_ciphertext, this.config.masterKey),
      ) as ProviderCredentials;
      const options = JSON.parse(scan.options || '{}') as ScanOptions;

      const { results, log, exitCode } = await runScan({
        provider: scan.provider as Provider,
        credentials,
        options,
        scannerPath: this.config.scannerPath,
        timeoutMs: this.config.scannerTimeoutMs,
      });

      if (results.length === 0 && exitCode !== 0) {
        this.logger.error({ scanId, exitCode, tail: log.slice(-500) }, 'scan produced no results');
        this.store.finishScan(
          scanId,
          'failed',
          { result: 0, fail: 0, warn: 0 },
          `Scanner exited with code ${exitCode} and produced no results`,
        );
        return;
      }

      for (const result of results) {
        const meta = getPluginMeta(scan.provider, result.plugin, this.config.scannerPath);
        if (!meta) continue;
        result.severity ??= meta.severity;
        result.more_info ??= meta.moreInfo;
        result.link ??= meta.link;
        result.recommended_action ??= meta.recommendedAction;
      }

      this.store.saveFindings(scanId, results);
      this.store.finishScan(scanId, 'succeeded', tally(results), null);
      this.logger.info(
        { scanId, ms: Date.now() - startedAt, results: results.length },
        'scan complete',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.store.finishScan(scanId, 'failed', { result: 0, fail: 0, warn: 0 }, message);
      this.logger.error({ scanId, err }, 'scan failed');
    }
  }
}

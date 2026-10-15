import { loadConfig } from './config.ts';
import { Store } from './db/index.ts';
import { buildApp } from './app.ts';
import { ScanWorker, type Logger } from './worker/index.ts';

async function main(): Promise<void> {
  const config = loadConfig();
  const store = new Store(config.dbPath);
  const app = await buildApp(config, store);

  const worker = new ScanWorker(store, config, app.log as unknown as Logger);
  worker.start();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    worker.stop();
    await app.close();
    store.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.host, port: config.port });
  app.log.info(`CloudSploit web API listening on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

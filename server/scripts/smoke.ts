// End-to-end smoke test. Runs the API and worker in-process, then exercises
// the full flow with the real GCP service-account in ../cloudsploit/gcp-key.json.
// Usage: node --env-file-if-exists=.env --import tsx scripts/smoke.ts
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.DATA_DIR = './data-smoke';
process.env.WORKER_INTERVAL_MS = '1000';

const { loadConfig } = await import('../src/config.ts');
const { Store } = await import('../src/db/index.ts');
const { buildApp } = await import('../src/app.ts');
const { ScanWorker } = await import('../src/worker/index.ts');

const config = loadConfig();
const store = new Store(config.dbPath);
const app = await buildApp(config, store);
await app.listen({ host: '127.0.0.1', port: 0 });
const worker = new ScanWorker(store, config, app.log as never);
worker.start();

const address = app.server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
console.log('API base:', base);

let cookie = '';
async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) cookie = c.split(';')[0] ?? cookie;
  return res;
}

function check(name: string, cond: boolean, extra?: unknown) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) {
    if (extra !== undefined) console.log('      ', extra);
    process.exitCode = 1;
  }
}

try {
  const email = `smoke_${Date.now()}@example.com`;
  let res = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'correct horse battery staple' }),
  });
  const reg = await res.json();
  check('register', res.status === 201 && !!reg.user?.id, reg);

  res = await api('/api/auth/me');
  const me = await res.json();
  check('me (authenticated via cookie)', res.status === 200 && me.user?.email === email, me);

  const sa = readFileSync(resolve('..', 'cloudsploit', 'gcp-key.json'), 'utf8');
  res = await api('/api/accounts', {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke GCP', provider: 'google', credentials: sa }),
  });
  const accountRes = await res.json();
  check('create account', res.status === 201 && !!accountRes.account?.id, accountRes);

  res = await api('/api/scans', {
    method: 'POST',
    body: JSON.stringify({ accountId: accountRes.account.id, plugin: 'instanceNodeCount' }),
  });
  const scanRes = await res.json();
  const scanId = scanRes.scan?.id;
  check('create scan', res.status === 202 && !!scanId, scanRes);

  let scan: any;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    res = await api(`/api/scans/${scanId}`);
    scan = (await res.json()).scan;
    if (scan?.status === 'succeeded' || scan?.status === 'failed') break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check('scan finished', scan?.status === 'succeeded', scan);

  res = await api(`/api/scans/${scanId}/findings`);
  const findings = await res.json();
  check('findings returned', res.status === 200 && findings.findings.length > 0, {
    count: findings.findings?.length,
    first: findings.findings?.[0],
  });

  const first = findings.findings?.[0];
  check(
    'findings enriched with severity + remediation',
    !!first && !!first.severity && !!first.recommended_action,
    { severity: first?.severity, recommended_action: first?.recommended_action },
  );

  res = await api(`/api/accounts/${accountRes.account.id}`, { method: 'DELETE' });
  const del = await res.json();
  check('delete account', res.status === 200 && del.ok === true, del);

  res = await api('/api/accounts');
  const after = await res.json();
  check(
    'account removed from list',
    Array.isArray(after.accounts) && !after.accounts.some((a: { id: string }) => a.id === accountRes.account.id),
    after,
  );

  res = await api('/api/auth/logout', { method: 'POST' });
  check('logout', res.status === 200, await res.json());
} finally {
  worker.stop();
  await app.close();
  store.close();
  rmSync(config.dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

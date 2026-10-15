import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type {
  CloudAccount,
  Finding,
  FindingStatus,
  Provider,
  PublicAccount,
  Scan,
  ScanOptions,
  ScannerResult,
  User,
} from '../types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AccountRow {
  id: string;
  user_id: string;
  provider: Provider;
  name: string;
  project_id: string | null;
  credential_ciphertext: string;
  created_at: string;
}

/**
 * Thin, typed data-access layer over SQLite. Centralises all SQL so route
 * handlers never build queries by hand (helps prevent injection and keeps
 * statements consistent).
 */
export class Store {
  readonly db: DatabaseSync;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8');
    this.db.exec(schema);
    this.migrate();
  }

  /** Adds columns introduced after a database was first created (idempotent). */
  private migrate(): void {
    this.ensureColumn('findings', 'severity', 'TEXT');
    this.ensureColumn('findings', 'more_info', 'TEXT');
    this.ensureColumn('findings', 'link', 'TEXT');
    this.ensureColumn('findings', 'recommended_action', 'TEXT');
  }

  private ensureColumn(table: string, column: string, type: string): void {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as unknown as {
      name: string;
    }[];
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }

  close(): void {
    this.db.close();
  }

  // ---- Users ----

  createUser(email: string, passwordHash: string, role: 'user' | 'admin' = 'user'): User {
    const user: User = {
      id: randomUUID(),
      email: email.toLowerCase(),
      password_hash: passwordHash,
      role,
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(user.id, user.email, user.password_hash, user.role, user.created_at);
    return user;
  }

  findUserByEmail(email: string): User | undefined {
    return this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase()) as User | undefined;
  }

  findUserById(id: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  updatePassword(id: string, passwordHash: string): void {
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  }

  countUsers(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return row.n;
  }

  // ---- Accounts ----

  createAccount(
    userId: string,
    provider: Provider,
    name: string,
    projectId: string | null,
    credentialCiphertext: string,
  ): CloudAccount {
    const account: CloudAccount = {
      id: randomUUID(),
      user_id: userId,
      provider,
      name,
      project_id: projectId,
      credential_ciphertext: credentialCiphertext,
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO accounts (id, user_id, provider, name, project_id, credential_ciphertext, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        account.id,
        account.user_id,
        account.provider,
        account.name,
        account.project_id,
        account.credential_ciphertext,
        account.created_at,
      );
    return account;
  }

  listAccounts(userId: string): PublicAccount[] {
    const rows = this.db
      .prepare(
        'SELECT id, provider, name, project_id, created_at FROM accounts WHERE user_id = ? ORDER BY created_at DESC',
      )
      .all(userId) as unknown as AccountRow[];
    return rows.map(toPublicAccount);  }

  getAccountRaw(id: string, userId: string): AccountRow | undefined {
    return this.db
      .prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?')
      .get(id, userId) as AccountRow | undefined;
  }

  getAccountById(id: string): AccountRow | undefined {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as
      | AccountRow
      | undefined;
  }

  deleteAccount(id: string, userId: string): boolean {
    const info = this.db
      .prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return info.changes > 0;
  }

  // ---- Scans ----

  createScan(
    userId: string,
    accountId: string,
    provider: Provider,
    options: ScanOptions,
  ): Scan {
    const scan: Scan = {
      id: randomUUID(),
      user_id: userId,
      account_id: accountId,
      provider,
      status: 'queued',
      options: JSON.stringify(options),
      error: null,
      result_count: 0,
      fail_count: 0,
      warn_count: 0,
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
    };
    this.db
      .prepare(
        'INSERT INTO scans (id, user_id, account_id, provider, status, options, result_count, fail_count, warn_count, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)',
      )
      .run(
        scan.id,
        scan.user_id,
        scan.account_id,
        scan.provider,
        scan.status,
        scan.options,
        scan.created_at,
      );
    return scan;
  }

  getScan(id: string, userId: string): Scan | undefined {
    return this.db
      .prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?')
      .get(id, userId) as Scan | undefined;
  }

  listScans(userId: string, limit = 50): Scan[] {
    return this.db
      .prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit) as unknown as Scan[];
  }

  /** Atomically claims the oldest queued scan for the worker. */
  claimNextQueuedScan(): Scan | undefined {
    const candidate = this.db
      .prepare("SELECT * FROM scans WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1")
      .get() as Scan | undefined;
    if (!candidate) return undefined;

    const info = this.db
      .prepare(
        "UPDATE scans SET status = 'running', started_at = ? WHERE id = ? AND status = 'queued'",
      )
      .run(new Date().toISOString(), candidate.id);
    if (info.changes !== 1) return undefined;
    return { ...candidate, status: 'running' };
  }

  finishScan(
    id: string,
    status: 'succeeded' | 'failed',
    counts: { result: number; fail: number; warn: number },
    error: string | null,
  ): void {
    this.db
      .prepare(
        'UPDATE scans SET status = ?, finished_at = ?, result_count = ?, fail_count = ?, warn_count = ?, error = ? WHERE id = ?',
      )
      .run(
        status,
        new Date().toISOString(),
        counts.result,
        counts.fail,
        counts.warn,
        error,
        id,
      );
  }

  // ---- Findings ----

  saveFindings(scanId: string, results: ScannerResult[]): void {
    const insert = this.db.prepare(
      'INSERT INTO findings (id, scan_id, plugin, category, title, description, resource, region, status, message, compliance, severity, more_info, link, recommended_action, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const now = new Date().toISOString();
    this.db.exec('BEGIN');
    try {
      for (const r of results) {
        insert.run(
          randomUUID(),
          scanId,
          r.plugin ?? null,
          r.category ?? null,
          r.title ?? null,
          r.description ?? null,
          r.resource ?? null,
          r.region ?? null,
          r.status ?? 'UNKNOWN',
          r.message ?? null,
          r.compliance ?? null,
          r.severity ?? null,
          r.more_info ?? null,
          r.link ?? null,
          r.recommended_action ?? null,
          now,
        );
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  listFindings(
    scanId: string,
    filters: { status?: FindingStatus; category?: string } = {},
  ): Finding[] {
    const clauses = ['scan_id = ?'];
    const params: (string | number)[] = [scanId];
    if (filters.status) {
      clauses.push('status = ?');
      params.push(filters.status);
    }
    if (filters.category) {
      clauses.push('category = ?');
      params.push(filters.category);
    }
    const sql = `SELECT * FROM findings WHERE ${clauses.join(' AND ')} ORDER BY CASE status WHEN 'FAIL' THEN 0 WHEN 'WARN' THEN 1 WHEN 'OK' THEN 2 ELSE 3 END, category, title`;
    return this.db.prepare(sql).all(...params) as unknown as Finding[];
  }
}

function toPublicAccount(row: AccountRow): PublicAccount {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}

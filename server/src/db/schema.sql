-- CloudSploit Web schema. All timestamps are ISO-8601 UTC strings.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,
  name                  TEXT NOT NULL,
  project_id            TEXT,
  credential_ciphertext TEXT NOT NULL,
  created_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

CREATE TABLE IF NOT EXISTS scans (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',
  options      TEXT NOT NULL DEFAULT '{}',
  error        TEXT,
  result_count INTEGER NOT NULL DEFAULT 0,
  fail_count   INTEGER NOT NULL DEFAULT 0,
  warn_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  started_at   TEXT,
  finished_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status, created_at);

CREATE TABLE IF NOT EXISTS findings (
  id          TEXT PRIMARY KEY,
  scan_id     TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  plugin      TEXT,
  category    TEXT,
  title       TEXT,
  description TEXT,
  resource    TEXT,
  region      TEXT,
  status      TEXT,
  message     TEXT,
  compliance  TEXT,
  severity             TEXT,
  more_info            TEXT,
  link                 TEXT,
  recommended_action   TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(scan_id, status);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(scan_id, severity);

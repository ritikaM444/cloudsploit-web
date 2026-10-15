export type Provider = 'google' | 'aws' | 'azure' | 'oracle' | 'github' | 'alibaba';

export type ScanStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type FindingStatus = 'OK' | 'WARN' | 'FAIL' | 'UNKNOWN';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface CloudAccount {
  id: string;
  user_id: string;
  provider: Provider;
  name: string;
  project_id: string | null;
  credential_ciphertext: string;
  created_at: string;
}

export interface PublicAccount {
  id: string;
  provider: Provider;
  name: string;
  projectId: string | null;
  createdAt: string;
}

export interface ScanOptions {
  plugin?: string;
  compliance?: string[];
}

export interface Scan {
  id: string;
  user_id: string;
  account_id: string;
  provider: Provider;
  status: ScanStatus;
  options: string;
  error: string | null;
  result_count: number;
  fail_count: number;
  warn_count: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface Finding {
  id: string;
  scan_id: string;
  plugin: string | null;
  category: string | null;
  title: string | null;
  description: string | null;
  resource: string | null;
  region: string | null;
  status: FindingStatus;
  message: string | null;
  compliance: string | null;
  severity: string | null;
  more_info: string | null;
  link: string | null;
  recommended_action: string | null;
  created_at: string;
}

/** Shape of results emitted by `cloudsploit --json=<file>`. */
export interface ScannerResult {
  plugin: string;
  category: string;
  title: string;
  description: string;
  resource: string;
  region: string;
  status: FindingStatus;
  message: string;
  compliance?: string;
  /** Enriched from plugin metadata after the scan completes. */
  severity?: string;
  more_info?: string;
  link?: string;
  recommended_action?: string;
}

/** Normalised credentials passed to the scanner for the chosen provider. */
export type ProviderCredentials = Record<string, unknown>;

/** Backwards-compatible alias for Google service-account credentials. */
export interface GoogleCredentials {
  type?: string;
  project: string;
  project_id?: string;
  client_email: string;
  private_key: string;
}

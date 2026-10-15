export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export type Provider = 'google' | 'aws' | 'azure' | 'oracle' | 'github' | 'alibaba';

export interface Account {
  id: string;
  provider: Provider;
  name: string;
  projectId: string | null;
  createdAt: string;
}

export type ScanStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type FindingStatus = 'OK' | 'WARN' | 'FAIL' | 'UNKNOWN';

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
}

export interface FindingsResponse {
  scan: Scan;
  summary: { total: number; fail: number; warn: number; ok: number };
  findings: Finding[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // Only advertise a JSON body when we actually send one. Sending this header
  // with an empty body makes Fastify reject the request (FST_ERR_CTP_EMPTY_JSON_BODY).
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers,
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    let message = res.statusText;
    if (data && typeof data === 'object' && 'error' in data) {
      message = String((data as { error: unknown }).error);
    }
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/api/auth/me'),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listAccounts: () => request<{ accounts: Account[] }>('/api/accounts'),
  createAccount: (input: { name: string; provider: Provider; credentials: unknown }) =>
    request<{ account: Account }>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteAccount: (id: string) =>
    request<{ ok: boolean }>(`/api/accounts/${id}`, { method: 'DELETE' }),

  listScans: () => request<{ scans: Scan[] }>('/api/scans'),
  createScan: (input: { accountId: string; plugin?: string; compliance?: string[] }) =>
    request<{ scan: Scan }>('/api/scans', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getScan: (id: string) => request<{ scan: Scan }>(`/api/scans/${id}`),
  getFindings: (id: string) =>
    request<FindingsResponse>(`/api/scans/${id}/findings`),
};

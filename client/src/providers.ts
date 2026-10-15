import type { Provider } from './api.ts';

export const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  {
    id: 'google',
    label: 'Google Cloud',
    hint: 'Service-account JSON key (project_id, client_email, private_key).',
  },
  {
    id: 'aws',
    label: 'Amazon Web Services',
    hint: 'JSON with access_key + secret_access_key (and optional session_token).',
  },
  {
    id: 'azure',
    label: 'Microsoft Azure',
    hint: 'JSON with application_id, key_value, directory_id, subscription_id.',
  },
  {
    id: 'oracle',
    label: 'Oracle Cloud (OCI)',
    hint: 'JSON with tenancy_id, user_id, key_fingerprint, key_value.',
  },
  { id: 'github', label: 'GitHub', hint: 'JSON with token (and optional organization).' },
  { id: 'alibaba', label: 'Alibaba Cloud', hint: 'JSON with access_key + access_key_secret.' },
];

export function providerLabel(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

import type { Provider, ProviderCredentials } from '../types.ts';

export interface ParsedCredentials {
  credentials: ProviderCredentials;
  identifier: string | null;
}

export interface ProviderDefinition {
  id: Provider;
  label: string;
  /** Short guidance shown in the UI about the credential file to upload. */
  hint: string;
  parse(input: unknown): ParsedCredentials;
}

function asObject(input: unknown): Record<string, unknown> {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('Credentials are empty');
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Credentials are not valid JSON');
    }
    return asObject(parsed);
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  throw new Error('Credentials must be a JSON object');
}

function str(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function first(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = str(obj, key);
    if (value) return value;
  }
  return undefined;
}

function required(obj: Record<string, unknown>, keys: string[], label: string): string {
  const value = first(obj, keys);
  if (!value) throw new Error(`Missing required field: ${label}`);
  return value;
}

function optional(obj: Record<string, unknown>, keys: string[], label: string): string | undefined {
  return first(obj, keys);
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'google',
    label: 'Google Cloud',
    hint: 'Service-account JSON key (project_id, client_email, private_key).',
    parse(input) {
      const obj = asObject(input);
      const project = required(obj, ['project', 'project_id'], 'project_id');
      const clientEmail = required(obj, ['client_email'], 'client_email');
      const privateKey = required(obj, ['private_key'], 'private_key');
      if (!clientEmail.includes('@')) throw new Error('Invalid client_email');
      if (!privateKey.startsWith('-----BEGIN')) throw new Error('Invalid private_key');
      return {
        identifier: project,
        credentials: {
          type: str(obj, 'type') ?? 'service_account',
          project,
          client_email: clientEmail,
          private_key: privateKey,
        },
      };
    },
  },
  {
    id: 'aws',
    label: 'Amazon Web Services',
    hint: 'JSON with access_key, secret_access_key and optional session_token/region.',
    parse(input) {
      const obj = asObject(input);
      const credentials: ProviderCredentials = {
        access_key: required(obj, ['access_key', 'accessKeyId', 'accessKey'], 'access_key'),
        secret_access_key: required(
          obj,
          ['secret_access_key', 'secretAccessKey', 'secretKey'],
          'secret_access_key',
        ),
      };
      const token = optional(obj, ['session_token', 'sessionToken'], 'session_token');
      if (token) credentials.session_token = token;
      const region = optional(obj, ['region', 'default_region'], 'region');
      if (region) credentials.region = region;
      return { credentials, identifier: first(obj, ['account_id', 'accountId']) ?? null };
    },
  },
  {
    id: 'azure',
    label: 'Microsoft Azure',
    hint: 'JSON with application_id, key_value, directory_id and subscription_id.',
    parse(input) {
      const obj = asObject(input);
      const subscription = required(
        obj,
        ['subscription_id', 'subscriptionId'],
        'subscription_id',
      );
      const credentials: ProviderCredentials = {
        application_id: required(obj, ['application_id', 'client_id', 'appId'], 'application_id'),
        key_value: required(obj, ['key_value', 'client_secret', 'password'], 'key_value'),
        directory_id: required(obj, ['directory_id', 'tenant_id', 'tenantId'], 'directory_id'),
        subscription_id: subscription,
      };
      const storage = optional(obj, ['storage_connection'], 'storage_connection');
      if (storage) credentials.storage_connection = storage;
      const blob = optional(obj, ['blob_container'], 'blob_container');
      if (blob) credentials.blob_container = blob;
      return { credentials, identifier: subscription };
    },
  },
  {
    id: 'oracle',
    label: 'Oracle Cloud (OCI)',
    hint: 'JSON with tenancy_id, user_id, key_fingerprint and key_value (private key).',
    parse(input) {
      const obj = asObject(input);
      const tenancy = required(obj, ['tenancy_id', 'tenancy_ocid', 'tenancyId'], 'tenancy_id');
      const credentials: ProviderCredentials = {
        tenancy_id: tenancy,
        compartment_id:
          optional(obj, ['compartment_id', 'compartment_ocid', 'compartmentId'], 'compartment_id') ??
          tenancy,
        user_id: required(obj, ['user_id', 'user_ocid', 'userId'], 'user_id'),
        key_fingerprint: required(obj, ['key_fingerprint', 'fingerprint'], 'key_fingerprint'),
        key_value: required(obj, ['key_value', 'private_key', 'privateKey'], 'key_value'),
      };
      const region = optional(obj, ['region'], 'region');
      if (region) credentials.region = region;
      return { credentials, identifier: tenancy };
    },
  },
  {
    id: 'github',
    label: 'GitHub',
    hint: 'JSON with a token (personal access token) and optional organization/login.',
    parse(input) {
      const obj = asObject(input);
      const credentials: ProviderCredentials = {
        token: required(obj, ['token', 'access_token', 'personal_access_token'], 'token'),
      };
      const url = optional(obj, ['url'], 'url');
      if (url) credentials.url = url;
      const login = optional(obj, ['login'], 'login');
      if (login) credentials.login = login;
      const organization = optional(obj, ['organization', 'org'], 'organization');
      if (organization) credentials.organization = organization;
      return { credentials, identifier: first(obj, ['login', 'organization', 'org']) ?? null };
    },
  },
  {
    id: 'alibaba',
    label: 'Alibaba Cloud',
    hint: 'JSON with access_key, access_key_secret and optional region.',
    parse(input) {
      const obj = asObject(input);
      const credentials: ProviderCredentials = {
        access_key: required(obj, ['access_key', 'accessKeyId', 'accessKey'], 'access_key'),
        access_key_secret: required(
          obj,
          ['access_key_secret', 'accessKeySecret', 'secretKey'],
          'access_key_secret',
        ),
      };
      const region = optional(obj, ['region'], 'region');
      if (region) credentials.region = region;
      return { credentials, identifier: first(obj, ['account_id', 'accountId']) ?? null };
    },
  },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id) as [Provider, ...Provider[]];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function providerLabel(id: string): string {
  return getProvider(id)?.label ?? id;
}

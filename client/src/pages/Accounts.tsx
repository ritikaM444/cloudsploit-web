import { useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Provider } from '../api.ts';
import { PROVIDERS, providerLabel } from '../providers.ts';

export function Accounts() {
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.listAccounts });

  const [provider, setProvider] = useState<Provider>('google');
  const [name, setName] = useState('');
  const [json, setJson] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const active = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0]!;

  function loadFile(file: File) {
    if (file.size > 64 * 1024) {
      setError('That file is too large to be a credentials key (max 64 KB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      try {
        const obj = JSON.parse(text) as Record<string, unknown>;
        setJson(text);
        setFileName(file.name);
        setError(null);
        setNotice(null);
        const guess =
          (obj.project_id as string) ||
          (obj.subscription_id as string) ||
          (obj.login as string) ||
          (obj.tenancy_id as string);
        if (guess) setName((current) => current || guess);
      } catch {
        setError('That file is not valid JSON.');
      }
    };
    reader.readAsText(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  const create = useMutation({
    mutationFn: () =>
      api.createAccount({ name: name.trim(), provider, credentials: json.trim() }),
    onSuccess: async () => {
      setName('');
      setJson('');
      setFileName(null);
      setError(null);
      setNotice('Account added. The key was encrypted with AES-256-GCM before being stored.');
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Failed to add account'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: async () => {
      setNotice(
        'Account removed. Its encrypted credential file was permanently deleted from the database — nothing is retained.',
      );
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Failed to remove account'),
  });

  function onRemove(id: string, label: string) {
    setNotice(null);
    setError(null);
    const ok = window.confirm(
      `Remove "${label}"?\n\nThis permanently deletes the stored (encrypted) credentials from the database. This cannot be undone.`,
    );
    if (ok) remove.mutate(id);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      JSON.parse(json);
    } catch {
      setError('The credentials are not valid JSON');
      return;
    }
    create.mutate();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Cloud accounts</h1>
        <p className="text-sm text-slate-400">
          Credentials are encrypted with AES-256-GCM before being stored.
        </p>
      </div>

      {notice && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60">
          <h2 className="border-b border-slate-800 px-5 py-3 text-sm font-semibold text-white">
            Connected accounts
          </h2>
          {accounts.isLoading ? (
            <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
          ) : (accounts.data?.accounts.length ?? 0) === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No accounts connected yet.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {accounts.data?.accounts.map((account) => (
                <li key={account.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm text-white">{account.name}</div>
                    <div className="text-xs text-slate-400">
                      {providerLabel(account.provider)} · {account.projectId ?? 'no identifier'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(account.id, account.name)}
                    disabled={remove.isPending}
                    className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-red-950 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={onSubmit} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Add an account</h2>

          <label className="mb-1 block text-xs text-slate-400">Cloud provider</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as Provider);
              setError(null);
            }}
            className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-xs text-slate-400">Display name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production project"
            className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
          />

          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs text-slate-400">Credentials JSON</label>
            <label className="cursor-pointer rounded-md border border-slate-700 px-2.5 py-1 text-xs text-sky-300 hover:bg-slate-800">
              Upload file…
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={onFileChange}
              />
            </label>
          </div>
          <p className="mb-2 text-xs text-slate-500">{active.hint}</p>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`block rounded-md border border-dashed px-3 py-2 transition-colors ${
              dragging ? 'border-sky-500 bg-sky-950/30' : 'border-slate-700'
            }`}
          >
            <textarea
              required
              value={json}
              onChange={(e) => {
                setJson(e.target.value);
                setFileName(null);
              }}
              rows={8}
              spellCheck={false}
              placeholder="Drag a .json key/credentials file here, click Upload file…, or paste the JSON below."
              className="w-full resize-y bg-transparent font-mono text-xs text-white outline-none placeholder:text-slate-600"
            />
          </label>

          <div className="mt-1 mb-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {fileName ? `Loaded: ${fileName}` : 'No file selected — you can paste instead.'}
            </span>
            {json && (
              <button
                type="button"
                onClick={() => {
                  setJson('');
                  setFileName(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={create.isPending}
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {create.isPending ? 'Saving…' : 'Add account'}
          </button>
        </form>
      </div>
    </div>
  );
}

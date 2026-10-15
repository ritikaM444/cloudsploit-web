import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api.ts';
import { providerLabel } from '../providers.ts';
import { ScanStatusBadge } from '../components/Badges.tsx';

const COMPLIANCE_OPTIONS = ['cis', 'cis1', 'cis2', 'hipaa', 'pci'] as const;

export function Scans() {
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.listAccounts });
  const scans = useQuery({
    queryKey: ['scans'],
    queryFn: api.listScans,
    refetchInterval: (query) => {
      const list = query.state.data?.scans ?? [];
      return list.some((s) => s.status === 'queued' || s.status === 'running') ? 2000 : false;
    },
  });

  const [accountId, setAccountId] = useState('');
  const [plugin, setPlugin] = useState('');
  const [compliance, setCompliance] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      api.createScan({
        accountId,
        plugin: plugin.trim() || undefined,
        compliance: compliance.length ? compliance : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    create.mutate();
  }

  const accountList = accounts.data?.accounts ?? [];
  const scanList = scans.data?.scans ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Scans</h1>
        <p className="text-sm text-slate-400">Run and monitor CloudSploit scans</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5"
      >
        <div>
          <label className="mb-1 block text-xs text-slate-400">Account</label>
          <select
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
          >
            <option value="">Select account…</option>
            {accountList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {providerLabel(a.provider)}
                {a.projectId ? ` (${a.projectId})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Check (optional)</label>
          <input
            value={plugin}
            onChange={(e) => setPlugin(e.target.value)}
            placeholder="e.g. instanceNodeCount"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
          />
          <p className="mt-1 text-xs text-slate-500">Leave blank for a full scan (all checks).</p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Compliance (optional)</label>
          <div className="flex flex-wrap gap-2">
            {COMPLIANCE_OPTIONS.map((c) => (
              <label key={c} className="flex items-center gap-1 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={compliance.includes(c)}
                  onChange={(e) =>
                    setCompliance((prev) =>
                      e.target.checked ? [...prev, c] : prev.filter((x) => x !== c),
                    )
                  }
                />
                {c}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={!accountId || create.isPending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {create.isPending ? 'Starting…' : 'Start scan'}
        </button>
      </form>

      {accountList.length === 0 && (
        <p className="text-sm text-slate-400">
          Add an account on the{' '}
          <Link to="/accounts" className="text-sky-400 hover:underline">
            Accounts
          </Link>{' '}
          page first.
        </p>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <h2 className="border-b border-slate-800 px-5 py-3 text-sm font-semibold text-white">
          Scan history
        </h2>
        {scans.isLoading ? (
          <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
        ) : scanList.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No scans yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-2">Started</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2">Results</th>
                  <th className="px-5 py-2">Fail</th>
                  <th className="px-5 py-2">Warn</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {scanList.map((scan) => (
                  <tr key={scan.id}>
                    <td className="px-5 py-3 text-slate-300">
                      {new Date(scan.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <ScanStatusBadge status={scan.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-300">{scan.result_count}</td>
                    <td className="px-5 py-3 text-red-400">{scan.fail_count}</td>
                    <td className="px-5 py-3 text-amber-400">{scan.warn_count}</td>
                    <td className="px-5 py-3">
                      <Link to={`/scans/${scan.id}`} className="text-sky-400 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

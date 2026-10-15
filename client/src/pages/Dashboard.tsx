import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api.ts';
import { ScanStatusBadge } from '../components/Badges.tsx';
import { ManualContent } from '../components/ManualContent.tsx';

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${tone ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

export function Dashboard() {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.listAccounts });
  const scans = useQuery({ queryKey: ['scans'], queryFn: api.listScans });
  const [showManual, setShowManual] = useState(true);

  const scanList = scans.data?.scans ?? [];
  const latest = scanList[0];
  const totalFail = scanList.reduce((sum, s) => sum + s.fail_count, 0);
  const totalWarn = scanList.reduce((sum, s) => sum + s.warn_count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">Overview of your connected accounts and scans</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <span className="text-sm font-semibold text-white">
            User manual — how to use this app
          </span>
          <span className="text-xs text-sky-400">{showManual ? 'Hide' : 'Show'}</span>
        </button>
        {showManual && (
          <div className="max-h-80 overflow-y-auto border-t border-slate-800 p-5">
            <ManualContent />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Connected accounts" value={accounts.data?.accounts.length ?? 0} />
        <StatCard label="Scans run" value={scanList.length} />
        <StatCard label="Failures found" value={totalFail} tone="text-red-400" />
        <StatCard label="Warnings found" value={totalWarn} tone="text-amber-400" />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Recent scans</h2>
          <Link to="/scans" className="text-sm text-sky-400 hover:underline">
            View all
          </Link>
        </div>
        {scans.isLoading ? (
          <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
        ) : scanList.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">
            No scans yet.{' '}
            <Link to="/accounts" className="text-sky-400 hover:underline">
              Add an account
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {scanList.slice(0, 5).map((scan) => (
              <li key={scan.id} className="flex items-center justify-between px-5 py-3">
                <Link to={`/scans/${scan.id}`} className="text-sm text-slate-200 hover:text-white">
                  {new Date(scan.created_at).toLocaleString()}
                </Link>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-red-400">{scan.fail_count} fail</span>
                  <span className="text-amber-400">{scan.warn_count} warn</span>
                  <ScanStatusBadge status={scan.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {latest?.status === 'failed' && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Latest scan failed: {latest.error ?? 'unknown error'}
        </p>
      )}
    </div>
  );
}

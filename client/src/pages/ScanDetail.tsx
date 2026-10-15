import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, type Finding, type FindingStatus } from '../api.ts';
import { FindingStatusBadge, ScanStatusBadge } from '../components/Badges.tsx';
import { FindingDrawer } from '../components/FindingDrawer.tsx';
import { downloadFindingsCsv, downloadFindingsJson } from '../lib/exportFindings.ts';

type StatusFilter = FindingStatus | 'ALL';
type SeverityFilter = 'ALL' | 'High' | 'Medium' | 'Low';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'FAIL', label: 'Failures' },
  { key: 'WARN', label: 'Warnings' },
  { key: 'OK', label: 'Passed' },
  { key: 'UNKNOWN', label: 'Unknown' },
];

const SEVERITY_FILTERS: SeverityFilter[] = ['ALL', 'High', 'Medium', 'Low'];

export function ScanDetail() {
  const { id = '' } = useParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [selected, setSelected] = useState<Finding | null>(null);

  const query = useQuery({
    queryKey: ['findings', id],
    queryFn: () => api.getFindings(id),
    refetchInterval: (q) => {
      const status = q.state.data?.scan.status;
      return status === 'queued' || status === 'running' ? 2000 : false;
    },
  });

  const findings = query.data?.findings ?? [];

  const visible = useMemo(
    () =>
      findings.filter(
        (f) =>
          (statusFilter === 'ALL' || f.status === statusFilter) &&
          (severityFilter === 'ALL' || f.severity === severityFilter),
      ),
    [findings, statusFilter, severityFilter],
  );

  if (query.isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (query.isError || !query.data) {
    return <p className="text-sm text-red-400">Scan not found.</p>;
  }

  const { scan, summary } = query.data;
  const score = summary.total > 0 ? Math.round((summary.ok / summary.total) * 100) : 0;
  const stamp = new Date(scan.created_at).toISOString().slice(0, 10);
  const fileBase = `cloudsploit-${id.slice(0, 8)}-${stamp}`;

  const count = (key: StatusFilter) =>
    key === 'ALL' ? findings.length : findings.filter((f) => f.status === key).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/scans" className="text-sm text-sky-400 hover:underline">
            ← Back to scans
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-white">Scan results</h1>
          <p className="text-sm text-slate-400">
            Started {new Date(scan.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScanStatusBadge status={scan.status} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadFindingsCsv(visible, `${fileBase}.csv`)}
              disabled={visible.length === 0}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => downloadFindingsJson(visible, `${fileBase}.json`)}
              disabled={visible.length === 0}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {scan.status === 'failed' && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {scan.error ?? 'Scan failed'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <ScoreCard score={score} />
        <Summary label="Total checks" value={summary.total} />
        <Summary label="Failed" value={summary.fail} tone="text-red-400" />
        <Summary label="Warnings" value={summary.warn} tone="text-amber-400" />
        <Summary label="Passed" value={summary.ok} tone="text-emerald-400" />
      </div>

      <div className="space-y-3">
        <FilterRow label="Status">
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.key}
              active={statusFilter === f.key}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label} <span className="text-slate-500">{count(f.key)}</span>
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Severity">
          {SEVERITY_FILTERS.map((s) => (
            <Chip
              key={s}
              active={severityFilter === s}
              onClick={() => setSeverityFilter(s)}
            >
              {s === 'ALL' ? 'All' : s}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Severity</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Finding</th>
              <th className="px-4 py-2">Resource</th>
              <th className="px-4 py-2">Region</th>
              <th className="px-4 py-2">Message</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No findings match these filters.
                </td>
              </tr>
            ) : (
              visible.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setSelected(f)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelected(f);
                  }}
                  tabIndex={0}
                  role="button"
                  className="cursor-pointer align-top hover:bg-slate-800/50 focus:bg-slate-800/50 focus:outline-none"
                >
                  <td className="px-4 py-3">
                    <FindingStatusBadge status={f.status} />
                  </td>
                  <td className="px-4 py-3">
                    <SeverityCell severity={f.severity} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{f.category}</td>
                  <td className="px-4 py-3 text-slate-200">
                    <div className="font-medium">{f.title}</div>
                    <div className="text-xs text-slate-500">{f.plugin}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{f.resource}</td>
                  <td className="px-4 py-3 text-slate-400">{f.region}</td>
                  <td className="px-4 py-3 text-slate-300">{f.message}</td>
                  <td className="px-4 py-3 text-right text-slate-500">›</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FindingDrawer finding={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ScoreCard({ score }: { score: number }) {
  const tone =
    score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-red-400';
  const ring =
    score >= 90
      ? 'ring-emerald-600/40'
      : score >= 70
        ? 'ring-amber-500/40'
        : 'ring-red-600/40';
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 ring-1 ${ring}`}>
      <div className="text-xs text-slate-400">Security score</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{score}%</div>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-xs uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-sm ${
        active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function SeverityCell({ severity }: { severity: string | null }) {
  const tone =
    severity === 'High' || severity === 'Critical'
      ? 'text-red-300'
      : severity === 'Medium'
        ? 'text-amber-300'
        : severity === 'Low'
          ? 'text-sky-300'
          : 'text-slate-500';
  return <span className={`text-xs font-medium ${tone}`}>{severity ?? '—'}</span>;
}

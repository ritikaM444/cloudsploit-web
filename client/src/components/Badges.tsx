import type { FindingStatus, ScanStatus } from '../api.ts';

const scanColors: Record<ScanStatus, string> = {
  queued: 'bg-slate-700 text-slate-200',
  running: 'bg-blue-600 text-white',
  succeeded: 'bg-emerald-600 text-white',
  failed: 'bg-red-600 text-white',
};

const findingColors: Record<FindingStatus, string> = {
  OK: 'bg-emerald-600/20 text-emerald-300 ring-emerald-600/40',
  WARN: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
  FAIL: 'bg-red-600/20 text-red-300 ring-red-600/40',
  UNKNOWN: 'bg-slate-600/20 text-slate-300 ring-slate-600/40',
};

const severityColors: Record<string, string> = {
  Critical: 'bg-red-700/25 text-red-200 ring-red-600/50',
  High: 'bg-red-600/20 text-red-300 ring-red-600/40',
  Medium: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
  Low: 'bg-sky-500/20 text-sky-300 ring-sky-500/40',
};

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${scanColors[status]}`}
    >
      {status}
    </span>
  );
}

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ring-1 ${findingColors[status]}`}
    >
      {status}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className="text-xs text-slate-600">—</span>;
  const color =
    severityColors[severity] ?? 'bg-slate-600/20 text-slate-300 ring-slate-600/40';
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ring-1 ${color}`}
    >
      {severity}
    </span>
  );
}

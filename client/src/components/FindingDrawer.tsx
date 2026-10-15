import { useEffect, type ReactNode } from 'react';
import type { Finding } from '../api.ts';
import { FindingStatusBadge, SeverityBadge } from './Badges.tsx';

export function FindingDrawer({
  finding,
  onClose,
}: {
  finding: Finding | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!finding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finding, onClose]);

  if (!finding) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-900 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FindingStatusBadge status={finding.status} />
              <SeverityBadge severity={finding.severity} />
            </div>
            <h2 className="text-lg font-semibold text-white">{finding.title}</h2>
            <p className="text-xs text-slate-500">
              {finding.category}
              {finding.plugin ? ` · ${finding.plugin}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
          <Field label="Why it failed">
            <p className="text-slate-200">{finding.message ?? '—'}</p>
          </Field>

          <Field label="Description">
            <p className="text-slate-300">{finding.description ?? '—'}</p>
          </Field>

          <Field label="More information">
            <p className="text-slate-300">{finding.more_info ?? '—'}</p>
          </Field>

          <Field label="Recommended action">
            <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-emerald-200">
              {finding.recommended_action ?? '—'}
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Resource">
              <p className="break-all font-mono text-xs text-slate-300">
                {finding.resource ?? '—'}
              </p>
            </Field>
            <Field label="Region">
              <p className="text-slate-300">{finding.region ?? '—'}</p>
            </Field>
          </div>

          {finding.compliance && (
            <Field label="Compliance">
              <p className="text-slate-300">{finding.compliance}</p>
            </Field>
          )}

          {finding.link && (
            <a
              href={finding.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sky-400 hover:underline"
            >
              Reference documentation →
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      {children}
    </div>
  );
}

import { ManualContent } from '../components/ManualContent.tsx';

export function Manual() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">User manual</h1>
        <p className="text-sm text-slate-400">
          Everything you need to use CloudSploit Web, start to finish.
        </p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <ManualContent />
      </div>
    </div>
  );
}

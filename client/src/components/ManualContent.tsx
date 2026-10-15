import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="space-y-2 text-sm text-slate-300">{children}</div>
    </section>
  );
}

export function ManualContent() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-300">
        CloudSploit Web checks your cloud account for security misconfigurations. It only{' '}
        <strong className="text-white">reads</strong> your settings — it never changes anything.
      </p>

      <Section title="1. Create an account / sign in">
        <p>
          Open the app and use <em>Create one</em> to register (password must be at least 10
          characters). The <strong className="text-white">first user becomes the administrator</strong>.
          Use <em>Sign in</em> on later visits.
        </p>
      </Section>

      <Section title="2. Add a cloud account">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Go to the <Link className="text-sky-400 hover:underline" to="/accounts">Accounts</Link> page.</li>
          <li>Choose the <strong className="text-white">cloud provider</strong> from the dropdown.</li>
          <li>Give it a <strong className="text-white">Display name</strong>.</li>
          <li>
            Provide the credentials <strong className="text-white">without copy-pasting</strong>: click{' '}
            <em>Upload file…</em>, drag-and-drop the <code>.json</code> file, or paste the JSON.
          </li>
          <li>Click <em>Add account</em>. The key is encrypted (AES-256-GCM) before it is stored.</li>
        </ol>
        <p className="text-slate-400">
          Google Cloud needs a service-account JSON (see the repo file <code>docs/gcp-setup.md</code>).
          Other providers use a small JSON with the fields shown under the upload box.
        </p>
      </Section>

      <Section title="3. Run a scan">
        <ul className="list-disc space-y-1 pl-5">
          <li>Go to the <Link className="text-sky-400 hover:underline" to="/scans">Scans</Link> page.</li>
          <li>Select the account, then click <em>Start scan</em>.</li>
          <li>Leave the <em>Check</em> field blank for a <strong className="text-white">full scan</strong>, or name a single check.</li>
          <li>Status moves <code>queued → running → succeeded</code> automatically.</li>
        </ul>
      </Section>

      <Section title="4. Read your results">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="text-emerald-300">Security score</strong> shows the percentage of checks passed.</li>
          <li>Filter by <strong className="text-white">status</strong> (Failures, Warnings, Passed) or by <strong className="text-white">severity</strong> (High/Medium/Low).</li>
          <li>Click any row to open its <strong className="text-white">remediation panel</strong> — why it failed and the exact fix.</li>
          <li>Use <em>Export CSV</em> / <em>Export JSON</em> to download the currently filtered results.</li>
        </ul>
      </Section>

      <Section title="5. Remove an account (deletes the data)">
        <p>
          On the Accounts page click <em>Remove</em> and confirm. The account <strong className="text-white">and
          its encrypted credential file are permanently deleted from the database</strong> — nothing is retained.
        </p>
      </Section>

      <Section title="6. Status colours">
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="text-emerald-300">OK</span> — the check passed.</li>
          <li><span className="text-red-300">FAIL</span> — a real problem; fix it.</li>
          <li><span className="text-amber-300">WARN</span> — worth reviewing.</li>
          <li><span className="text-slate-300">UNKNOWN</span> — could not run (often missing permissions).</li>
        </ul>
      </Section>
    </div>
  );
}

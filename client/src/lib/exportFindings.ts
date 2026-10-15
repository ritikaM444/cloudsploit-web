import type { Finding } from '../api.ts';

const CSV_COLUMNS: { key: keyof Finding; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'severity', label: 'Severity' },
  { key: 'category', label: 'Category' },
  { key: 'title', label: 'Title' },
  { key: 'plugin', label: 'Plugin' },
  { key: 'resource', label: 'Resource' },
  { key: 'region', label: 'Region' },
  { key: 'message', label: 'Message' },
  { key: 'description', label: 'Description' },
  { key: 'more_info', label: 'More Info' },
  { key: 'recommended_action', label: 'Recommended Action' },
  { key: 'link', label: 'Link' },
  { key: 'compliance', label: 'Compliance' },
];

/** Neutralises spreadsheet formula injection and applies RFC-4180 quoting. */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function findingsToCsv(findings: Finding[]): string {
  const header = CSV_COLUMNS.map((c) => csvCell(c.label)).join(',');
  const rows = findings.map((f) => CSV_COLUMNS.map((c) => csvCell(f[c.key])).join(','));
  return [header, ...rows].join('\r\n');
}

export function downloadFindingsJson(findings: Finding[], filename: string): void {
  const payload = JSON.stringify(
    { exportedAt: new Date().toISOString(), count: findings.length, findings },
    null,
    2,
  );
  download(filename, payload, 'application/json');
}

export function downloadFindingsCsv(findings: Finding[], filename: string): void {
  download(filename, findingsToCsv(findings), 'text/csv');
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

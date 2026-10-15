import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

export interface PluginMeta {
  title?: string;
  category?: string;
  domain?: string;
  severity?: string;
  description?: string;
  moreInfo?: string;
  link?: string;
  recommendedAction?: string;
}

const cache = new Map<string, PluginMeta>();
const loadedProviders = new Set<string>();

/**
 * Build a key -> metadata map for one provider's plugins by reading the plugin
 * manifest (`exports.js`) and requiring only that provider's plugin modules. We
 * avoid requiring the whole manifest so other providers' heavy dependencies
 * (aws-sdk, etc.) are never pulled into the server process.
 */
function load(provider: string, scannerPath: string): void {
  if (loadedProviders.has(provider)) return;
  loadedProviders.add(provider);

  try {
    const cloudsploitDir = dirname(resolve(scannerPath));
    const src = readFileSync(join(cloudsploitDir, 'exports.js'), 'utf8');

    const block = sliceBlock(src, new RegExp(`${provider}\\s*:\\s*\\{`));
    if (block === null) return;

    const entry =
      /(['"]?)([A-Za-z0-9_]+)\1\s*:\s*require\(\s*__dirname\s*\+\s*(['"])([^'"]+)\3\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = entry.exec(block)) !== null) {
      const key = match[2];
      const relPath = match[4];
      if (!key || !relPath) continue;
      try {
        const plugin = require(join(cloudsploitDir, relPath)) as Record<string, unknown>;
        cache.set(`${provider}:${key}`, {
          title: str(plugin.title),
          category: str(plugin.category),
          domain: str(plugin.domain),
          severity: str(plugin.severity),
          description: str(plugin.description),
          moreInfo: str(plugin.more_info),
          link: str(plugin.link),
          recommendedAction: str(plugin.recommended_action),
        });
      } catch {
        // A single unloadable plugin must not break metadata for the rest.
      }
    }
  } catch {
    // If the manifest is unavailable we simply skip enrichment.
  }
}

/** Returns the metadata for a plugin key, or undefined if unknown. */
export function getPluginMeta(
  provider: string,
  key: string | null | undefined,
  scannerPath: string,
): PluginMeta | undefined {
  if (!key) return undefined;
  load(provider, scannerPath);
  return cache.get(`${provider}:${key}`);
}

/** Extracts the contents of the object literal whose opening brace follows `marker`. */
function sliceBlock(src: string, marker: RegExp): string | null {
  const at = src.search(marker);
  if (at === -1) return null;
  const start = src.indexOf('{', at);
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

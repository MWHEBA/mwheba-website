import fs from 'node:fs';
import path from 'node:path';

export interface RedirectEntry {
  legacyUrl: string;
  sourcePath: string;
  targetUrl: string;
  targetPath: string;
  action: 'PRESERVE' | 'REDIRECT_301' | 'GONE_410' | 'REQUIRES_REVIEW';
  statusCode: number;
  routeType: string;
  notes: string;
}

/**
 * Parses docs/audit/05-redirect-map.csv into structured RedirectEntry array.
 */
export function parseRedirectCsv(csvContent: string): RedirectEntry[] {
  const lines = csvContent.trim().split(/\r?\n/);
  const header = lines[0]; // legacy_url,target_url,action_classification,status_code,route_type,notes
  const entries: RedirectEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV quoting for notes
    let match: RegExpMatchArray | null;
    const regex = /^(https:\/\/[^,]+),([^,]+),([A-Z0-9_]+),(\d+),([^,]+),(".*"|.*)$/;
    match = line.match(regex);

    if (!match) {
      throw new Error(`Failed to parse CSV line ${i + 1}: ${line}`);
    }

    const legacyUrl = match[1].trim();
    const targetUrl = match[2].trim();
    const action = match[3].trim() as RedirectEntry['action'];
    const statusCode = parseInt(match[4].trim(), 10);
    const routeType = match[5].trim();
    let notes = match[6].trim();
    if (notes.startsWith('"') && notes.endsWith('"')) {
      notes = notes.slice(1, -1).replace(/""/g, '"');
    }

    const sourcePath = new URL(legacyUrl).pathname;
    let targetPath = targetUrl;
    try {
      targetPath = new URL(targetUrl).pathname;
      const targetSearch = new URL(targetUrl).search;
      if (targetSearch) {
        targetPath += targetSearch;
      }
    } catch {
      // relative or non-URL
    }

    entries.push({
      legacyUrl,
      sourcePath,
      targetUrl,
      targetPath,
      action,
      statusCode,
      routeType,
      notes,
    });
  }

  return entries;
}

export function compileRedirectMap(): void {
  const csvPath = path.resolve(process.cwd(), 'docs/audit/05-redirect-map.csv');
  const outPath = path.resolve(process.cwd(), 'src/config/redirects.json');

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const entries = parseRedirectCsv(csvContent);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2), 'utf8');
  console.log(`Successfully compiled ${entries.length} redirect rules to ${outPath}`);
}

if (process.argv[1] && process.argv[1].includes('compileRedirectMap.ts')) {
  compileRedirectMap();
}

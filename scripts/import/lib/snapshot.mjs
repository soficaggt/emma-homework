// Reads a snapshot of the old Google Sheet: one JSON file per tab, exactly as the Google Sheets API
// returns it ({ range, values: [[header...], [row...], ...] }). Trailing empty cells are missing in
// that format, so every row is padded out to the header length.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const TABS = ['Tasks', 'Template', 'Squishies', 'Ledger', 'Days', 'Status'];

function rowsOf(file) {
  const j = JSON.parse(readFileSync(file, 'utf8'));
  const values = j.values || [];
  if (!values.length) return { header: [], rows: [] };
  const header = values[0].map(h => String(h).trim());
  const rows = values.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    header.forEach((h, k) => { o[h] = r[k] == null ? '' : String(r[k]); });
    return o;
  });
  return { header, rows };
}

export function readSnapshot(dir) {
  if (!existsSync(dir)) throw new Error(`snapshot folder not found: ${dir}`);
  const out = { dir, tabs: {} };
  for (const t of TABS) {
    const f = join(dir, `${t}.json`);
    out.tabs[t] = existsSync(f) ? rowsOf(f) : null;
  }
  // Settings: only the two safe names are ever copied (sofiaKey and textTo are never read).
  const sf = join(dir, 'Settings-safe.json');
  out.settings = {};
  if (existsSync(sf)) {
    const { rows } = rowsOf(sf);
    for (const r of rows) {
      const k = (r.setting || '').trim();
      if (k === 'noProofTypes' || k === 'noAlertTypes') out.settings[k] = r.value || '';
    }
  }
  const pf = join(dir, 'drive-photos.json');
  out.drivePhotos = existsSync(pf) ? JSON.parse(readFileSync(pf, 'utf8')).files || [] : null;
  for (const t of ['Tasks', 'Squishies', 'Ledger', 'Template']) {
    if (!out.tabs[t]) throw new Error(`snapshot is missing ${t}.json`);
  }
  return out;
}

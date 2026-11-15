import { createHash } from 'node:crypto';

export const TZ = 'America/New_York';

// Fixed namespace for this import. A row's new ID is worked out from the student and the old ID,
// so running the import again finds the same row and updates it instead of adding a copy.
const NAMESPACE = '6f1d3c2a-8b4e-5a7f-9c10-2d3e4f5a6b7c';

export function uuidv5(name, ns = NAMESPACE) {
  const nsBytes = Buffer.from(ns.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(name, 'utf8')])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
export const newId = (studentId, kind, oldKey) => uuidv5(`${studentId}:${kind}:${oldKey}`);

export function bool(v) { return String(v).trim().toUpperCase() === 'TRUE'; }
export function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()); }
export function isTimestamp(s) { return !!s && !isNaN(Date.parse(s)); }

export function nyDate(ts) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function addDays(s, n) {
  const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function monday(s) { const wd = new Date(s + 'T12:00:00Z').getUTCDay(); return addDays(s, -((wd + 6) % 7)); }
export function dayGap(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }

// The old "how long" box was free text. Returns { minutes, keepText } where keepText is set when the
// text says more than a length (a class time like "5:50 to 7:20", or "In school"), so it can be kept.
export function parseDuration(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return { minutes: null, keepText: null };
  const range = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?$/);
  if (range) {
    let a = Number(range[1]) * 60 + Number(range[2] || 0), b = Number(range[3]) * 60 + Number(range[4] || 0);
    if (b <= a) b += 12 * 60;
    return { minutes: Math.min(600, b - a), keepText: String(raw).trim() };
  }
  const hm = s.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)(?:\s*(\d+)\s*(?:m|min|mins|minutes))?$/);
  if (hm) return { minutes: Math.round(Number(hm[1]) * 60 + Number(hm[2] || 0)), keepText: null };
  const m = s.match(/^(\d+)\s*(?:m|min|mins|minutes)?$/);
  if (m) return { minutes: Math.min(600, Number(m[1])), keepText: null };
  return { minutes: null, keepText: String(raw).trim() };
}

// Dollar-quoted JSON for SQL, with a tag that cannot appear in the data.
export function sqlJson(obj) {
  const text = JSON.stringify(obj);
  let tag = 'j';
  while (text.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${text}$${tag}$::jsonb`;
}

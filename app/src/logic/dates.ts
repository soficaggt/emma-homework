// "Today" is the student's own day, in her own time zone (America/New_York for Emma).
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  } catch { /* unknown zone: fall through */ }
  return todayIn("America/New_York", now);
}

export function addDays(s: string, n: number): string {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const fmt = (s: string, o: Intl.DateTimeFormatOptions) => new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
export const dayName = (s: string) => fmt(s, { weekday: "long" });
export const shortDay = (s: string) => fmt(s, { weekday: "short" });
export const shortDate = (s: string) => fmt(s, { month: "short", day: "numeric" });
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

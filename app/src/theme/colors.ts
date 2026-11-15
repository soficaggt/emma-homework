// How a task gets its color. Everything comes from the student's color system: the steps, their
// colors and meanings, the rules for guessing a step from the due date, and the per-subject shades.
import type { ColorStep, ColorSystem, PaletteMode } from "./types";

export type ColorTask = { type: string; date: string; due_date: string | null; title: string; note: string | null; color_step: number | null };

export const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(((h % 360) + 360) % 360)}, ${Math.round(s * 10) / 10}%, ${Math.round(l * 10) / 10}%)`;

const dayGap = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

const clampStep = (i: number | null, sys: ColorSystem) => (i === null || !sys.steps.length ? null : Math.min(Math.max(i, 0), sys.steps.length - 1));

// The step a task gets when she (or the helper) has not picked one.
export function defaultStep(t: ColorTask, today: string, sys: ColorSystem): number | null {
  if (sys.mode === "none" || !sys.steps.length) return null;
  if (sys.mode === "by_type") return clampStep(sys.typeSteps[t.type] ?? 0, sys);
  if (sys.mode === "by_subject") {
    const hay = `${t.title} ${t.note ?? ""}`;
    const hit = sys.subjects.find((s) => safeTest(s.pattern, hay));
    return clampStep(hit ? hit.step : 0, sys);
  }
  const r = sys.rules;
  if (t.type === "fixed") return clampStep(r.plan ?? 0, sys);
  if (t.type === "flex") return clampStep(r.flex ?? 0, sys);
  if (!t.due_date) return clampStep(t.type === "test" ? (r.noDueTest ?? r.noDue) : r.noDue, sys) ?? 0;
  const ref = t.date < today ? today : t.date;          // a task from an earlier day counts from today
  const gap = Math.max(0, dayGap(ref, t.due_date) - 1);   // due within 1 day = the first step
  const g = r.byGap;
  if (!g.length) return 0;
  return clampStep(g[Math.min(gap, g.length - 1)], sys);
}

export function stepIndex(t: ColorTask, today: string, sys: ColorSystem): number | null {
  if (sys.mode === "none") return null;
  return clampStep(t.color_step, sys) ?? defaultStep(t, today, sys);
}

const reCache = new Map<string, RegExp | null>();
function safeTest(pattern: string, s: string): boolean {
  let re = reCache.get(pattern);
  if (re === undefined) { try { re = new RegExp(pattern, "i"); } catch { re = null; } reCache.set(pattern, re); }
  return !!re && re.test(s);
}

// Each subject leans its color a little warmer or cooler, so two equally important tasks still look different.
export function shadeShift(t: ColorTask, step: ColorStep, sys: ColorSystem): number {
  if (!step.shadeScale) return 0;
  const hit = sys.shades.find((s) => safeTest(s.pattern, `${t.title} ${t.note ?? ""}`.toLowerCase()));
  return hit ? Math.round(hit.shift * step.shadeScale) : 0;
}

// bg: the task's row. strong: its color for marks. box: the check box outline (the step color when it can be seen
// against the card, otherwise the readable ink). ink: text on the row. chip: small pill background.
export type StepLook = { bg: string; strong: string; box: string; ink: string; chip: string; heart: string; heartStroke?: string; edge?: string };

const withAlpha = (c: string, a: number) => { const [r, g, b] = toRgb(c); return `rgba(${r}, ${g}, ${b}, ${a})`; };

export function stepLook(step: ColorStep, shift: number, p: PaletteMode): StepLook {
  const hh = step.hue + shift;
  const strong = step.ink ?? hsl(hh, p.strongS * step.sat, p.strongL);
  const ink = step.ink ?? p.fg;
  return {
    bg: step.surface ?? hsl(hh, p.tintS * step.sat, p.tintL),
    strong,
    box: contrast(strong, p.card) >= 3 ? strong : ink,
    ink,
    chip: step.chip ?? p.card,
    heart: step.heart ?? hsl(hh, 85 * step.sat, 64),
    heartStroke: step.heartStroke ?? withAlpha(ink, 0.55),
    edge: step.edge,
  };
}

// The look for a task with no color system at all (mode "none"): quiet, no meaning.
export function quietLook(p: PaletteMode): StepLook {
  return { bg: p.card, strong: p.accent, box: p.accent, ink: p.fg, chip: p.bg2, heart: p.accent };
}

// ---- contrast, used by the accessibility checks ----
export function toRgb(c: string): [number, number, number] {
  const s = c.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = s.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (!m) throw new Error("unsupported color " + c);
  const h = Number(m[1]) / 360, sa = Number(m[2]) / 100, l = Number(m[3]) / 100;
  const q = l < 0.5 ? l * (1 + sa) : l + sa - l * sa, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((x) => Math.round(x * 255)) as [number, number, number];
}
const lum = (c: string) => {
  const [r, g, b] = toRgb(c).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

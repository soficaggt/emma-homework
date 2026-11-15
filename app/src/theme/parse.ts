// Turns a themes row into a Theme. Anything missing or odd falls back to the neutral baseline,
// so a half-filled theme (like a new student's empty "Starter" row) never breaks the screen.
import { NEUTRAL, NEUTRAL_WORDING } from "./neutral";
import type { ColorStep, ColorSystem, Mode, PaletteMode, PageKey, Theme, ThemeRow } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9.,%\s\/-]+\))$/i;
const color = (v: unknown, d: string) => (typeof v === "string" && COLOR.test(v.trim()) ? v.trim() : d);
const num = (v: unknown, d: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const text = (v: unknown, d: string, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d);
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 30 ? v : null);

function parsePalette(raw: unknown, mode: Mode): PaletteMode {
  const d = NEUTRAL.palette[mode];
  const r = isObj(raw) && isObj(raw[mode]) ? (raw[mode] as Record<string, unknown>) : {};
  return {
    bg: color(r.bg, d.bg), bg2: color(r.bg2, d.bg2), card: color(r.card, d.card), fg: color(r.fg, d.fg),
    muted: color(r.muted, d.muted), line: color(r.line, d.line), accent: color(r.accent, d.accent),
    accentInk: color(r.accentInk, d.accentInk), good: color(r.good, d.good), alert: color(r.alert, d.alert), alertInk: color(r.alertInk, d.alertInk),
    ledge: color(r.ledge, d.ledge),
    tintL: num(r.tintL, d.tintL, 5, 98), tintS: num(r.tintS, d.tintS, 0, 100),
    strongL: num(r.strongL, d.strongL, 5, 95), strongS: num(r.strongS, d.strongS, 0, 100),
  };
}

function parseStep(raw: unknown): ColorStep | null {
  if (!isObj(raw)) return null;
  const opt = (v: unknown) => (typeof v === "string" && COLOR.test(v.trim()) ? v.trim() : undefined);
  return {
    key: text(raw.key, ""), name: text(raw.name, ""), meaning: text(raw.meaning, ""),
    hue: num(raw.hue, 0, 0, 360), sat: num(raw.sat, 1, 0, 1), shadeScale: num(raw.shadeScale, 1, 0, 1),
    surface: opt(raw.surface), ink: opt(raw.ink), edge: opt(raw.edge), chip: opt(raw.chip),
    heart: opt(raw.heart), heartStroke: opt(raw.heartStroke),
  };
}

const idxOrNull = (v: unknown) => int(v);

export function parseColorSystem(raw: unknown): ColorSystem {
  if (!isObj(raw)) return NEUTRAL.colorSystem;
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).map(parseStep).filter((s): s is ColorStep => !!s && !!s.name);
  const modes = ["urgency_ladder", "by_subject", "by_type", "none"] as const;
  let mode = modes.find((m) => m === raw.mode) ?? "none";
  if (!steps.length) mode = "none";
  const rr = isObj(raw.rules) ? raw.rules : {};
  const byGap = (Array.isArray(rr.byGap) ? rr.byGap : []).map(int).filter((n): n is number => n !== null);
  const typeSteps: Record<string, number> = {};
  if (isObj(raw.typeSteps)) for (const [k, v] of Object.entries(raw.typeSteps)) { const n = int(v); if (n !== null) typeSteps[k] = n; }
  const pat = (v: unknown) => text(v, "", 120);
  return {
    mode, steps,
    rules: { byGap, plan: idxOrNull(rr.plan), flex: idxOrNull(rr.flex), noDue: idxOrNull(rr.noDue), noDueTest: idxOrNull(rr.noDueTest) },
    shades: (Array.isArray(raw.shades) ? raw.shades : []).filter(isObj)
      .map((s) => ({ pattern: pat(s.pattern), shift: num(s.shift, 0, -60, 60) })).filter((s) => s.pattern),
    typeSteps,
    subjects: (Array.isArray(raw.subjects) ? raw.subjects : []).filter(isObj)
      .map((s) => ({ pattern: pat(s.pattern), step: int(s.step) ?? 0 })).filter((s) => s.pattern),
  };
}

export function parseTheme(row: ThemeRow | null | undefined): Theme {
  if (!row) return NEUTRAL;
  const depths = ["rewards_only", "light", "medium", "whole_app"] as const;
  const depth = depths.find((d) => d === row.theming_depth) ?? "whole_app";
  const colorSystem = parseColorSystem(row.color_system);
  const cur = isObj(row.currency) ? row.currency : {};
  const currency = { name: text(cur.name, NEUTRAL.currency.name, 30), look: text(cur.look, NEUTRAL.currency.look, 30) };
  // A student who only wants her rewards themed keeps the calm frame. Her color legend and currency still apply.
  // (light, medium and whole_app all show the full theme until step 9 defines the differences.)
  if (depth === "rewards_only") return { ...NEUTRAL, name: text(row.name, NEUTRAL.name, 60), depth, colorSystem, currency };

  const f = isObj(row.fonts) ? row.fonts : {};
  const sh = isObj(row.shapes) ? row.shapes : {};
  const w = isObj(row.wording) ? row.wording : {};
  const wording = { ...NEUTRAL_WORDING };
  for (const [k, v] of Object.entries(w)) if (k in NEUTRAL_WORDING && typeof v === "string" && v.trim()) wording[k] = v.slice(0, 300);
  const pn = isObj(row.page_names) ? row.page_names : {};
  const pageNames = { ...NEUTRAL.pageNames };
  (Object.keys(pageNames) as PageKey[]).forEach((k) => { pageNames[k] = text(pn[k], pageNames[k], 30); });
  return {
    name: text(row.name, "Theme", 60), depth,
    palette: { light: parsePalette(row.palette, "light"), dark: parsePalette(row.palette, "dark") },
    fonts: { display: text(f.display, "system", 30), body: text(f.body, "system", 30) },
    shapes: {
      card: num(sh.card, NEUTRAL.shapes.card, 0, 40), task: num(sh.task, NEUTRAL.shapes.task, 0, 32),
      pill: num(sh.pill, NEUTRAL.shapes.pill, 0, 99), check: num(sh.check, NEUTRAL.shapes.check, 0, 16),
      ledge: num(sh.ledge, NEUTRAL.shapes.ledge, 0, 10),
    },
    wording, pageNames, currency, colorSystem,
  };
}

// Fill in {name}, {day} and so on.
export function say(theme: Theme, key: string, vars: Record<string, string | number> = {}): string {
  const raw = theme.wording[key] ?? NEUTRAL_WORDING[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : ""));
}

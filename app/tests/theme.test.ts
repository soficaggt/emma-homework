/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseTheme, say } from "@/theme/parse";
import { NEUTRAL } from "@/theme/neutral";
import { contrast, defaultStep, hsl, shadeShift, stepIndex, stepLook } from "@/theme/colors";
import type { ColorTask } from "@/theme/colors";

const emmaRow = JSON.parse(readFileSync(new URL("../theme-data/emma.theme.json", import.meta.url), "utf8"));
const emma = parseTheme(emmaRow);
const sys = emma.colorSystem;
const t = (o: Partial<ColorTask> = {}): ColorTask => ({ type: "school", date: "2026-11-16", due_date: null, title: "Reading", note: null, color_step: null, ...o });

describe("theme parsing", () => {
  it("an empty Starter row gives the neutral baseline, never a crash", () => {
    expect(parseTheme({ name: "Starter", palette: {}, color_system: { mode: "none", steps: [] } }).colorSystem.mode).toBe("none");
    expect(parseTheme(null)).toBe(NEUTRAL);
    expect(parseTheme({ palette: "junk", fonts: 5, wording: [], color_system: 7 } as never).palette.light.bg).toBe(NEUTRAL.palette.light.bg);
  });
  it("ignores colors that are not colors, and clamps numbers", () => {
    const th = parseTheme({ palette: { light: { bg: "url(javascript:alert(1))", tintL: 9999 } }, shapes: { card: -4 } });
    expect(th.palette.light.bg).toBe(NEUTRAL.palette.light.bg);
    expect(th.palette.light.tintL).toBe(98);
    expect(th.shapes.card).toBe(0);
  });
  it("reads Emma's theme from data", () => {
    expect(emma.fonts).toEqual({ display: "fredoka", body: "nunito" });
    expect(emma.pageNames.collection).toBe("Shelf");
    expect(emma.palette.light.accent).toBe("#7f48f0");
    expect(emma.palette.dark.bg).toBe("#17132a");
    expect(sys.steps.map((s) => s.key)).toEqual(["purple", "blue", "white", "pink", "orange", "yellow", "green", "gray"]);
    expect(sys.steps[0].meaning).toBe("Must do today");
    expect(say(emma, "title", { name: "Emma" })).toBe("Emma's Homework");
  });
  it("a student who only wants her rewards themed keeps the calm frame but her own color legend", () => {
    const th = parseTheme({ ...emmaRow, theming_depth: "rewards_only" });
    expect(th.palette.light.accent).toBe(NEUTRAL.palette.light.accent);
    expect(th.fonts.display).toBe("system");
    expect(th.colorSystem.steps.length).toBe(8);
  });
  it("a color system with no steps becomes none", () => {
    expect(parseTheme({ color_system: { mode: "urgency_ladder", steps: [] } }).colorSystem.mode).toBe("none");
  });
  it("Emma's theme has no red and no black among her task colors (her theme's own rule)", () => {
    const names = sys.steps.map((s) => s.name.toLowerCase());
    expect(names).not.toContain("red");
    expect(names).not.toContain("black");
  });
});

describe("color rules (same as the old site's priorityColor)", () => {
  const today = "2026-11-16";
  const step = (o: Partial<ColorTask>) => sys.steps[defaultStep(t({ date: today, ...o }), today, sys)!].key;
  it("guesses from the due date", () => {
    expect(step({ due_date: "2026-11-16" })).toBe("purple");
    expect(step({ due_date: "2026-11-17" })).toBe("purple");
    expect(step({ due_date: "2026-11-18" })).toBe("blue");
    expect(step({ due_date: "2026-11-19" })).toBe("white");
    expect(step({ due_date: "2026-11-20" })).toBe("pink");
    expect(step({ due_date: "2026-11-21" })).toBe("orange");
    expect(step({ due_date: "2026-11-22" })).toBe("yellow");
    expect(step({ due_date: "2026-11-23" })).toBe("green");
    expect(step({ due_date: "2027-03-01" })).toBe("green");
  });
  it("plans, dinner and no-due-date tasks", () => {
    expect(step({ type: "fixed" })).toBe("purple");
    expect(step({ type: "flex" })).toBe("yellow");
    expect(step({ type: "school" })).toBe("white");
    expect(step({ type: "test" })).toBe("blue");
  });
  it("a task left over from an earlier day counts from today", () => {
    expect(sys.steps[defaultStep(t({ date: "2026-11-10", due_date: "2026-11-17" }), today, sys)!].key).toBe("purple");
  });
  it("a picked step wins over the guess; a step beyond the legend is held to its end", () => {
    expect(stepIndex(t({ color_step: 4, due_date: "2026-11-16" }), today, sys)).toBe(4);
    expect(stepIndex(t({ color_step: 99 }), today, sys)).toBe(7);
  });
  it("modes other than the urgency ladder work from the same data", () => {
    const byType = parseTheme({ color_system: { mode: "by_type", steps: [{ name: "A", hue: 10 }, { name: "B", hue: 100 }], typeSteps: { test: 1 } } }).colorSystem;
    expect(defaultStep(t({ type: "test" }), today, byType)).toBe(1);
    expect(defaultStep(t({ type: "school" }), today, byType)).toBe(0);
    const none = parseTheme(null).colorSystem;
    expect(stepIndex(t(), today, none)).toBeNull();
  });
  it("a bad pattern in theme data cannot crash the screen", () => {
    const bad = parseTheme({ color_system: { mode: "by_subject", steps: [{ name: "A", hue: 1 }], subjects: [{ pattern: "(", step: 0 }] } }).colorSystem;
    expect(defaultStep(t(), today, bad)).toBe(0);
  });
});

describe("subject shades and the exact colors the old CSS made", () => {
  it("each subject leans its color; warm colors lean half as far; white and gray never", () => {
    const [purple, , white, pink, , , , gray] = sys.steps;
    expect(shadeShift(t({ title: "Latin vocab" }), purple, sys)).toBe(-7);
    expect(shadeShift(t({ title: "History essay" }), purple, sys)).toBe(14);
    expect(shadeShift(t({ title: "History essay" }), pink, sys)).toBe(7);
    expect(shadeShift(t({ title: "Latin" }), white, sys)).toBe(0);
    expect(shadeShift(t({ title: "Latin" }), gray, sys)).toBe(0);
    expect(shadeShift(t({ title: "Something else" }), purple, sys)).toBe(0);
  });
  it("matches the old CSS: hsl(276 85% 92%) tint and hsl(276 70% 52%) strong in light mode", () => {
    const look = stepLook(sys.steps[0], 0, emma.palette.light);
    expect(look.bg).toBe(hsl(276, 85, 92));
    expect(look.strong).toBe(hsl(276, 70, 52));
    const dark = stepLook(sys.steps[0], 0, emma.palette.dark);
    expect(dark.bg).toBe(hsl(276, 38, 24));
    expect(dark.strong).toBe(hsl(276, 80, 68));
  });
  it("Emma's white keeps its fixed look in both modes", () => {
    for (const mode of ["light", "dark"] as const) {
      const l = stepLook(sys.steps[2], 0, emma.palette[mode]);
      expect(l.bg).toBe("#ffffff");
      expect(l.edge).toBe("#2b2440");
    }
  });
});

describe("readable contrast (an accessibility minimum for every theme)", () => {
  // Title text sits on each step's tint; small chip text sits on the card.
  for (const mode of ["light", "dark"] as const) {
    it(`Emma, ${mode}: task titles are readable on every step`, () => {
      const p = emma.palette[mode];
      for (const step of sys.steps) for (const shift of [-14, 0, 14]) {
        const look = stepLook(step, shift, p);
        expect(contrast(look.ink, look.bg), `${step.key} ${shift}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`Emma, ${mode}: every check box outline and heart can be seen against its card (3:1 or better)`, () => {
      const p = emma.palette[mode];
      for (const step of sys.steps) for (const shift of [-14, 0, 14]) {
        const look = stepLook(step, shift, p);
        expect(contrast(look.box, p.card) >= 3 || contrast(look.box, look.bg) >= 3, `${step.key} ${shift}`).toBe(true);
      }
    });
    it(`Emma, ${mode}: the accent color is readable as text on the page`, () => {
      const p = emma.palette[mode];
      expect(contrast(p.accent, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, p.card)).toBeGreaterThanOrEqual(4.5);
    });
    it(`Emma, ${mode}: body and note text are readable on cards`, () => {
      const p = emma.palette[mode];
      expect(contrast(p.fg, p.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, p.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, p.bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`Emma, ${mode}: button and chip text are readable on the accent and alert colors`, () => {
      const p = emma.palette[mode];
      expect(contrast(p.accentInk, p.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.alertInk, p.alert)).toBeGreaterThanOrEqual(4.5);
    });
    it(`neutral, ${mode}: all main pairs are readable`, () => {
      const p = NEUTRAL.palette[mode];
      expect(contrast(p.fg, p.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, p.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accentInk, p.accent)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// What a theme is, as the app uses it. It maps to the columns of the `themes` table
// (palette, fonts, shapes, wording, page_names, currency, color_system). Nothing in the app's
// logic names a color or says what a color means: it reads these.

export type Mode = "light" | "dark";

export type PaletteMode = {
  bg: string; bg2: string; card: string; fg: string; muted: string; line: string;
  accent: string; accentInk: string; good: string; alert: string; alertInk: string;
  ledge: string; // the hard shadow under cards
  // how task colors are made from a step's hue in this mode
  tintL: number; tintS: number; strongL: number; strongS: number;
};

export type ColorStep = {
  key: string; name: string; meaning: string;
  hue: number; sat: number;
  shadeScale: number;          // how much a subject's shade may lean this step (0 = none)
  surface?: string; ink?: string; edge?: string; chip?: string;   // fixed look, used by a step like Emma's white
  heart?: string; heartStroke?: string;
};

export type ColorRules = {
  byGap: number[];             // step for "due in 0 or 1 day", 2 days, ... in order; the last one holds for anything later
  plan: number | null; flex: number | null; noDue: number | null; noDueTest: number | null;
};

export type ColorSystem = {
  mode: "urgency_ladder" | "by_subject" | "by_type" | "none";
  steps: ColorStep[];
  rules: ColorRules;
  shades: { pattern: string; shift: number }[];     // each subject leans its color a little warmer or cooler
  typeSteps: Record<string, number>;                // used when mode is by_type
  subjects: { pattern: string; step: number }[];    // used when mode is by_subject
};

export type PageKey = "days" | "calendar" | "collection" | "shop";

export type Theme = {
  name: string;
  depth: "rewards_only" | "light" | "medium" | "whole_app";
  palette: Record<Mode, PaletteMode>;
  fonts: { display: string; body: string };
  shapes: { card: number; task: number; pill: number; check: number; ledge: number };
  wording: Record<string, string>;
  pageNames: Record<PageKey, string>;
  currency: { name: string; look: string };
  colorSystem: ColorSystem;
};

// A row of the themes table, as it comes back from the database.
export type ThemeRow = {
  name?: string | null; theming_depth?: string | null;
  palette?: unknown; fonts?: unknown; shapes?: unknown; wording?: unknown;
  page_names?: unknown; currency?: unknown; color_system?: unknown;
};

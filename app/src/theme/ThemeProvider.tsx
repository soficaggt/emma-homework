// Gives every screen the student's theme: colors for light or dark, fonts, shapes, wording.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme, type TextStyle } from "react-native";
import { useFonts } from "expo-font";
import { getRepo } from "@/data";
import { stepIndex, stepLook, quietLook, shadeShift, type ColorTask, type StepLook } from "./colors";
import { FONT_FILES, fontFamily } from "./fonts";
import { NEUTRAL } from "./neutral";
import { parseTheme, say } from "./parse";
import type { PaletteMode, Theme } from "./types";

type Ctx = {
  theme: Theme;
  p: PaletteMode;
  dark: boolean;
  say: (key: string, vars?: Record<string, string | number>) => string;
  display: (weight?: number) => TextStyle;
  body: (weight?: number) => TextStyle;
  // The look of a task: its step's colors, with its subject's shade.
  look: (t: ColorTask, today: string) => StepLook;
  // The look of one particular step for a task (used by the color picker).
  lookAt: (t: ColorTask, index: number) => StepLook;
  meaningOf: (t: ColorTask, today: string) => string;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ studentId, firstName, children }: { studentId: string; firstName: string; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(NEUTRAL);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);

  useEffect(() => {
    let alive = true;
    getRepo().theme(studentId)
      .then((row) => { if (alive) setTheme(parseTheme(row)); })
      .catch(() => { /* no theme row yet, or no connection: the calm baseline is fine */ })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [studentId]);

  const value = useMemo<Ctx>(() => {
    const dark = scheme === "dark";
    const p = theme.palette[dark ? "dark" : "light"];
    const sys = theme.colorSystem;
    const fam = (key: string, w: number): TextStyle => {
      const f = fontFamily(key, w);
      return f ? { fontFamily: f } : { fontWeight: String(w) as TextStyle["fontWeight"] };
    };
    const lookFor = (t: ColorTask, today: string): StepLook => {
      const i = stepIndex(t, today, sys);
      if (i === null) return quietLook(p);
      const step = sys.steps[i];
      return stepLook(step, shadeShift(t, step, sys), p);
    };
    const lookAt = (t: ColorTask, index: number): StepLook => {
      const step = sys.steps[index];
      return step ? stepLook(step, shadeShift(t, step, sys), p) : quietLook(p);
    };
    return {
      theme, p, dark, lookAt,
      say: (k, v) => say(theme, k, { firstName, name: firstName, ...v }),
      display: (w = 600) => fam(theme.fonts.display, w),
      body: (w = 600) => fam(theme.fonts.body, w),
      look: lookFor,
      meaningOf: (t, today) => { const i = stepIndex(t, today, sys); return i === null ? "" : sys.steps[i].meaning; },
    };
  }, [theme, scheme, firstName]);

  // Wait for the theme and the fonts (or for them to fail) so the screen does not flash the wrong look.
  if (!ready || !(fontsLoaded || fontError)) return null;
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}

// Fonts a theme can ask for by name. They ship inside the app (nothing is fetched from a font
// company when a child opens it). A theme that names a font not listed here gets the system font.
import {
  Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import {
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

export const FONT_FILES = {
  Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold,
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold,
};

const REGISTRY: Record<string, Record<number, string>> = {
  fredoka: { 500: "Fredoka_500Medium", 600: "Fredoka_600SemiBold", 700: "Fredoka_700Bold" },
  nunito: { 400: "Nunito_400Regular", 600: "Nunito_600SemiBold", 700: "Nunito_700Bold", 800: "Nunito_800ExtraBold" },
};

// The loaded font family for a theme's font key at (about) a weight, or undefined for the system font.
export function fontFamily(key: string, weight: number): string | undefined {
  const fam = REGISTRY[key];
  if (!fam) return undefined;
  const weights = Object.keys(fam).map(Number);
  const best = weights.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a));
  return fam[best];
}

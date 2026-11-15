// Small themed building blocks. Every color, font and shape comes from the student's theme.
import type { ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";

export const MIN_TAP = 44; // the smallest comfortable touch target, in points

export function Txt({ kind = "body", w, size = 16, color, style, ...rest }: TextProps & {
  kind?: "display" | "body"; w?: number; size?: number; color?: string; style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  const font = kind === "display" ? t.display(w ?? 600) : t.body(w ?? 600);
  return <Text {...rest} style={[{ fontSize: size, lineHeight: Math.round(size * 1.35), color: color ?? t.p.fg }, font, style]} />;
}

// A card with the hard "ledge" shadow under it, the same on every platform.
export function LedgeCard({ children, radius, pad = 18, style, bg }: {
  children: ReactNode; radius?: number; pad?: number; style?: StyleProp<ViewStyle>; bg?: string;
}) {
  const t = useTheme();
  const r = radius ?? t.theme.shapes.card;
  return (
    <View style={[{ backgroundColor: t.p.ledge, borderRadius: r, paddingBottom: t.theme.shapes.ledge }, style]}>
      <View style={{ backgroundColor: bg ?? t.p.card, borderRadius: r, padding: pad }}>{children}</View>
    </View>
  );
}

export function Pill({ label, onPress, tone = "ghost", pressed, small, a11y, disabled }: {
  label: string; onPress: () => void; tone?: "accent" | "ghost" | "outline"; pressed?: boolean; small?: boolean; a11y?: string; disabled?: boolean;
}) {
  const t = useTheme();
  const on = tone === "accent" || pressed;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ selected: pressed, disabled }}
      aria-selected={pressed} aria-disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={{
        minHeight: MIN_TAP, minWidth: MIN_TAP, justifyContent: "center", alignItems: "center", paddingHorizontal: small ? 14 : 20,
        borderRadius: t.theme.shapes.pill, opacity: disabled ? 0.5 : 1,
        backgroundColor: on ? t.p.accent : "transparent",
        borderWidth: on ? 0 : 2, borderColor: t.p.line,
      }}
    >
      <Txt kind="display" w={600} size={small ? 14 : 16} color={on ? t.p.accentInk : tone === "outline" ? t.p.accent : t.p.fg}>{label}</Txt>
    </Pressable>
  );
}

export function IconButton({ label, onPress, children, size = MIN_TAP, style }: {
  label: string; onPress: () => void; children: ReactNode; size?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      {children}
    </Pressable>
  );
}

export const HeartIcon = ({ fill, stroke, size = 26 }: { fill: string; stroke?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.2 0 3.9 1.3 5.4 3.2 1.5-1.9 3.2-3.2 5.4-3.2 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"
      fill={fill} stroke={stroke ?? "transparent"} strokeWidth={1.5} />
  </Svg>
);
export const ArrowIcon = ({ color, size = 16 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h12M13 7l5 5-5 5" />
  </Svg>
);
export const XIcon = ({ color, size = 12 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const ClockIcon = ({ color, size = 20 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Svg>
);

// A drawn coin. The look is the currency skin in the theme; the numbers never change.
const COINS: Record<string, { face: string; rim: string; shine: string }> = {
  gold: { face: "#ffd34d", rim: "#e6a817", shine: "#fff6c9" },
};
export function CoinIcon({ look, size = 22 }: { look: string; size?: number }) {
  const c = COINS[look] ?? COINS.gold;
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={10} fill={c.face} stroke={c.rim} strokeWidth={2} />
      <Circle cx={8} cy={7.5} r={3} fill={c.shine} opacity={0.9} />
    </Svg>
  );
}

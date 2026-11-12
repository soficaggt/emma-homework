// Plain, calm building blocks for the sign-in and Yoda screens. These neutral colors are only the
// app's frame before a student's theme loads (step 4 brings themes). They carry no meaning.
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const light = { bg: "#f7f6fb", card: "#ffffff", text: "#24212e", soft: "#5d5870", line: "#d9d5e6", accent: "#5b4bb7", onAccent: "#ffffff", note: "#efeafd" };
const dark = { bg: "#17151d", card: "#221f2b", text: "#f1eff7", soft: "#b9b4c9", line: "#3a3548", accent: "#a99cf0", onAccent: "#17151d", note: "#2c2740" };

export function useColors() {
  return useColorScheme() === "dark" ? dark : light;
}

export function Screen({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>{children}</Text>;
}

export function Body({ children, soft }: { children: ReactNode; soft?: boolean }) {
  const c = useColors();
  return <Text style={[s.body, { color: soft ? c.soft : c.text }]}>{children}</Text>;
}

// A kind message box. Used for both "done" and "try again" messages: no alarm colors.
export function Note({ children }: { children: ReactNode }) {
  const c = useColors();
  if (!children) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[s.note, { backgroundColor: c.note }]}>
      <Text style={[s.body, { color: c.text }]}>{children}</Text>
    </View>
  );
}

export function Field(props: TextInputProps & { label: string; hint?: string; secret?: boolean }) {
  const c = useColors();
  const [show, setShow] = useState(false);
  const { label, hint, secret, style, ...rest } = props;
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.text }]}>{label}</Text>
      {hint ? <Text style={[s.hint, { color: c.soft }]}>{hint}</Text> : null}
      <View style={s.row}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.soft}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secret && !show}
          style={[s.input, { color: c.text, borderColor: c.line, backgroundColor: c.card }, style]}
          {...rest}
        />
        {secret ? (
          <Pressable accessibilityRole="button" onPress={() => setShow(!show)} style={s.show} hitSlop={8}>
            <Text style={[s.link, { color: c.accent }]}>{show ? "Hide" : "Show"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Button({ title, onPress, busy, quiet, disabled }: {
  title: string; onPress: () => void; busy?: boolean; quiet?: boolean; disabled?: boolean;
}) {
  const c = useColors();
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        s.button,
        quiet ? { backgroundColor: "transparent", borderColor: c.accent, borderWidth: 2 } : { backgroundColor: c.accent },
        { opacity: off ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={quiet ? c.accent : c.onAccent} /> : (
        <Text style={[s.buttonText, { color: quiet ? c.accent : c.onAccent }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function LinkText({ title, onPress }: { title: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={s.linkWrap} hitSlop={8}>
      <Text style={[s.link, { color: c.accent }]}>{title}</Text>
    </Pressable>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={[s.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 16, alignItems: "center" },
  column: { width: "100%", maxWidth: 520, gap: 16, paddingVertical: 24 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: "700" },
  body: { fontSize: 18, lineHeight: 26 },
  note: { borderRadius: 12, padding: 14 },
  field: { gap: 6 },
  label: { fontSize: 18, fontWeight: "600" },
  hint: { fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minHeight: 52, borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, fontSize: 20 },
  show: { minHeight: 48, justifyContent: "center", paddingHorizontal: 6 },
  button: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  buttonText: { fontSize: 18, fontWeight: "700" },
  linkWrap: { minHeight: 44, justifyContent: "center" },
  link: { fontSize: 17, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

// The delete confirmation and the small message at the bottom. Calm wording, no alarm colors.
import { useEffect } from "react";
import { Modal, Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { LedgeCard, Pill, Txt } from "./ui";

export function Confirm({ title, message, yes, onYes, onCancel }: {
  title: string; message: string; yes: string; onYes: () => void; onCancel: () => void;
}) {
  const t = useTheme();
  return (
    <Modal transparent visible animationType="none" onRequestClose={onCancel} accessibilityViewIsModal>
      <Pressable accessibilityLabel={t.say("cancel")} onPress={onCancel} style={{ flex: 1, backgroundColor: "rgba(20,14,40,0.5)", justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Pressable onPress={() => undefined} accessible={false} style={{ width: "100%", maxWidth: 420 }}>
          <LedgeCard>
            <Txt kind="display" w={700} size={21} accessibilityRole="header">{title}</Txt>
            <Txt size={16} color={t.p.muted} style={{ marginTop: 6 }}>{message}</Txt>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <Pill label={t.say("cancel")} onPress={onCancel} />
              <Pill tone="accent" label={yes} onPress={onYes} />
            </View>
          </LedgeCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Stays until it is replaced or a few seconds pass. Read out politely by screen readers.
export function Toast({ message, id, onDone }: { message: string; id: number; onDone: () => void }) {
  const t = useTheme();
  useEffect(() => {
    if (!message) return;
    const h = setTimeout(onDone, 4500);
    return () => clearTimeout(h);
  }, [message, id, onDone]);
  if (!message) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: 24, alignItems: "center" }}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert"
        style={{ maxWidth: 420, width: "100%", backgroundColor: t.p.fg, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18 }}>
        <Txt w={700} size={16} color={t.p.card}>{message}</Txt>
      </View>
    </View>
  );
}

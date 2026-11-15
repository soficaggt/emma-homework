// The student's pages: sign-in check, her theme, the title, the page tabs and the coin counter.
// Only a signed-in student gets in. (The database would refuse anyone else's data anyway.)
import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { Redirect, Slot, router, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DEMO, getDemoStudent } from "@/data";
import { useBoard } from "@/data/useBoard";
import { useAuth } from "@/lib/auth";
import { FrameContext } from "@/lib/frame";
import { Loading } from "@/lib/ui";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { Toast } from "@/components/Overlays";
import { CoinIcon, Pill, Txt } from "@/components/ui";
import type { PageKey } from "@/theme/types";

const PAGES: { key: PageKey; href: "/days" | "/calendar" | "/shelf" | "/shop" }[] = [
  { key: "days", href: "/days" }, { key: "calendar", href: "/calendar" }, { key: "collection", href: "/shelf" }, { key: "shop", href: "/shop" },
];

export default function StudentLayout() {
  const auth = useAuth();
  const demo = DEMO ? getDemoStudent() : null;
  if (demo) return <ThemeProvider studentId={demo.id} firstName={demo.firstName}><Frame studentId={demo.id} /></ThemeProvider>;
  if (auth.loading) return <Loading />;
  if (!auth.session || !auth.profile) return <Redirect href="/sign-in" />;
  if (auth.profile.role !== "student") return <Redirect href="/home" />;
  return (
    <ThemeProvider studentId={auth.profile.id} firstName={auth.profile.first_name}>
      <Frame studentId={auth.profile.id} />
    </ThemeProvider>
  );
}

function Frame({ studentId }: { studentId: string }) {
  const t = useTheme();
  const auth = useAuth();
  const board = useBoard(studentId);
  const path = usePathname();
  const [kicker, setKicker] = useState("");
  const [msg, setMsg] = useState<{ key: string; id: number } | null>(null);
  const say = useCallback((key: string) => setMsg({ key, id: Date.now() }), []);
  const shown = board.notice ? { key: board.notice.key, id: board.notice.id } : msg;
  const dismiss = useCallback(() => setMsg(null), []);
  const firstName = auth.profile?.first_name ?? t.say("title").split("'")[0];

  return (
    <FrameContext.Provider value={{ board, setKicker, say }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.p.bg }}>
        <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: "100%", maxWidth: 720, paddingHorizontal: 16, paddingTop: 56, gap: 20 }}>
            <View style={{ alignItems: "center", gap: 10 }}>
              {kicker ? <Txt kind="display" size={14} color={t.p.accent} style={{ letterSpacing: 2, textTransform: "uppercase" }}>{kicker}</Txt> : null}
              <Txt kind="display" w={700} size={40} accessibilityRole="header" style={{ textAlign: "center", lineHeight: 44 }}>{t.say("title", { name: firstName })}</Txt>
            </View>

            <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
              {PAGES.map((pg) => {
                const on = path === pg.href || (pg.href === "/days" && (path === "/" || path === "/home"));
                return (
                  <Pressable key={pg.key} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} onPress={() => router.replace(pg.href)}
                    style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 18, borderRadius: t.theme.shapes.pill, backgroundColor: on ? t.p.accent : t.p.card, borderBottomWidth: 4, borderBottomColor: on ? t.p.accent : t.p.line }}>
                    <Txt kind="display" size={16} color={on ? t.p.accentInk : t.p.fg}>{t.theme.pageNames[pg.key]}</Txt>
                  </Pressable>
                );
              })}
            </View>

            <Slot />

            {!DEMO ? <View style={{ alignItems: "center", marginTop: 12 }}><Pill small label={t.say("sign_out")} onPress={auth.signOut} /></View> : null}
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button" accessibilityLabel={t.say("coins_open_shop", { currency: t.theme.currency.name })} onPress={() => router.replace("/shop")}
          style={{ position: "absolute", top: Platform.OS === "web" ? 12 : 8, right: 14, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 10, paddingRight: 14, borderRadius: t.theme.shapes.pill, backgroundColor: t.p.card, borderBottomWidth: 4, borderBottomColor: t.p.line }}
        >
          <CoinIcon look={t.theme.currency.look} />
          <Txt kind="display" size={17}>{String(board.coins?.spendable ?? 0)}</Txt>
          {board.coins && board.coins.waiting > 0 ? <Txt size={13} color={t.p.muted}>{`+${board.coins.waiting} ${t.say("waiting")}`}</Txt> : null}
        </Pressable>

        <Toast message={shown ? t.say(shown.key) : ""} id={shown?.id ?? 0} onDone={dismiss} />
      </SafeAreaView>
    </FrameContext.Provider>
  );
}

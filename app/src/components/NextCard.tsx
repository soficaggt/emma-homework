// The one clear next thing, with a place for a tiny first step in her own words (ADHD checks 1, 3 and 11).
// The first step is hers: she types it or taps an idea and can change it. Nothing is filled in for her.
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { dayName } from "@/logic/dates";
import { formatMinutes, type Next } from "@/logic/tasks";
import { useTheme } from "@/theme/ThemeProvider";
import { InlineText } from "./TaskRow";
import { LedgeCard, Pill, Txt } from "./ui";

export function NextCard({ next, today, onSaveFirstStep, showTimes }: {
  next: Next; today: string; onSaveFirstStep: (id: string, text: string) => void; showTimes: boolean;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState("");
  const id = next.kind === "task" ? next.task.id : "";
  useEffect(() => setDraft(""), [id]);

  if (next.kind !== "task") {
    return (
      <LedgeCard>
        <Txt kind="display" size={13} color={t.p.accent} style={{ letterSpacing: 1.4, textTransform: "uppercase" }}>{t.say("next_up")}</Txt>
        <Txt kind="display" size={20} style={{ marginTop: 4 }}>{t.say(next.kind === "all_done" ? "next_all_done" : "next_none")}</Txt>
      </LedgeCard>
    );
  }

  const { task } = next;
  const look = t.look(task, today);
  const ideas = t.say("first_step_ideas").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const save = () => { const v = draft.trim(); if (v) onSaveFirstStep(task.id, v); };

  return (
    <LedgeCard bg={look.bg}>
      <Txt kind="display" size={13} color={look.ink} style={{ letterSpacing: 1.4, textTransform: "uppercase" }}>{t.say("next_up")}</Txt>
      <Txt kind="display" w={700} size={26} color={look.ink} style={{ marginTop: 2 }}>{task.title}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {next.from === "earlier" ? <Txt size={14} color={look.ink}>{t.say("from_day", { day: dayName(task.date) })}</Txt> : null}
        {showTimes && task.minutes ? <Txt kind="display" size={14} color={look.ink}>{formatMinutes(task.minutes)}</Txt> : null}
      </View>

      <View style={{ marginTop: 14, padding: 14, borderRadius: t.theme.shapes.task, backgroundColor: t.p.card, gap: 8 }}>
        <Txt kind="display" size={14} color={t.p.muted}>{t.say("first_step")}</Txt>
        {task.first_step ? (
          <InlineText value={task.first_step} label={t.say("first_step")} size={19} weight={700}
            onSave={(v) => onSaveFirstStep(task.id, v)} />
        ) : (
          <>
            <Txt size={16}>{t.say("first_step_ask")}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ideas.map((idea) => (
                <Pressable key={idea} accessibilityRole="button" accessibilityLabel={idea} onPress={() => setDraft(idea)}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: t.theme.shapes.pill, backgroundColor: t.p.bg2 }}>
                  <Txt w={700} size={15}>{idea}</Txt>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <TextInput
                value={draft} onChangeText={setDraft} placeholder={t.say("first_step_placeholder")} placeholderTextColor={t.p.muted}
                accessibilityLabel={t.say("first_step")} returnKeyType="done" onSubmitEditing={save} maxLength={200}
                style={[{ flex: 1, minWidth: 180, minHeight: 48, borderWidth: 2, borderColor: t.p.line, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: t.p.fg, backgroundColor: t.p.card }, t.body(600)]}
              />
              <Pill label={t.say("first_step_save")} tone="accent" onPress={save} disabled={!draft.trim()} />
            </View>
          </>
        )}
      </View>
    </LedgeCard>
  );
}

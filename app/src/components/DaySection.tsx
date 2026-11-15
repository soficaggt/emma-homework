// One day's card (or the "Still to do from earlier" card), and the Not today pile.
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { dayName, shortDate } from "@/logic/dates";
import { formatTotal, progress, totalMinutes, type Task } from "@/logic/tasks";
import { useTheme } from "@/theme/ThemeProvider";
import { TaskRow, type RowActions } from "./TaskRow";
import { LedgeCard, Pill, Txt } from "./ui";

type Common = { today: string; showTimes: boolean; nextId?: string; a: RowActions };

export function DaySection({ date, title, earlier, tasks, onAdd, ...c }: Common & {
  date?: string; title?: string; earlier?: boolean; tasks: Task[]; onAdd?: (date: string, title: string) => Promise<boolean>;
}) {
  const t = useTheme();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const name = title ?? (date ? dayName(date) : "");
  const pr = progress(tasks);
  const total = totalMinutes(tasks);
  const isToday = date === c.today;

  const submit = async () => {
    const v = draft.trim();
    if (!v || !date || !onAdd) return;
    if (await onAdd(date, v)) { setDraft(""); setAdding(false); }
  };

  return (
    <LedgeCard style={earlier ? { borderRadius: t.theme.shapes.card, borderWidth: 2.5, borderStyle: "dashed", borderColor: t.p.alert } : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", flexShrink: 1, flexWrap: "wrap", gap: 6 }}>
          <Txt kind="display" w={700} size={25} accessibilityRole="header">{name}</Txt>
          {date ? <Txt w={600} size={15} color={t.p.muted}>{shortDate(date)}</Txt> : null}
          {isToday ? (
            <View style={{ backgroundColor: t.p.accent, borderRadius: t.theme.shapes.pill, paddingHorizontal: 9, paddingVertical: 2 }}>
              <Txt kind="display" size={11.5} color={t.p.accentInk} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>{t.say("today_tag")}</Txt>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {pr.total ? <Txt kind="display" size={16} color={t.p.accent}>{`${pr.done} of ${pr.total}`}</Txt> : null}
          {date && onAdd ? <Pill small tone="outline" label={t.say("add")} a11y={`${t.say("add")} ${name}`} onPress={() => setAdding(!adding)} pressed={adding} /> : null}
        </View>
      </View>
      {total && c.showTimes ? <Txt size={14} color={t.p.muted}>{formatTotal(total)}</Txt> : null}
      {pr.total ? (
        <View style={{ height: 8, borderRadius: 99, backgroundColor: t.p.line, overflow: "hidden", marginTop: 8 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: pr.total, now: pr.done }}>
          <View style={{ height: 8, borderRadius: 99, width: `${Math.round(pr.share * 100)}%`, backgroundColor: t.p.accent }} />
        </View>
      ) : null}

      {adding ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <TextInput
            autoFocus value={draft} onChangeText={setDraft} placeholder={t.say("add_placeholder")} placeholderTextColor={t.p.muted}
            accessibilityLabel={`${t.say("add")} ${name}`} returnKeyType="done" onSubmitEditing={submit} maxLength={200}
            style={[{ flex: 1, minWidth: 180, minHeight: 48, borderWidth: 2, borderColor: t.p.accent, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: t.p.fg, backgroundColor: t.p.card }, t.body(600)]}
          />
          <Pill label={t.say("add_save")} tone="accent" onPress={submit} disabled={!draft.trim()} />
        </View>
      ) : null}

      <View style={{ marginTop: 6 }}>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} today={c.today} showTimes={c.showTimes} showDate={earlier} isNext={task.id === c.nextId} a={c.a} />
        ))}
        {!tasks.length ? (
          <View style={{ margin: 6, padding: 12, borderRadius: 14, borderWidth: 2, borderStyle: "dashed", borderColor: t.p.line }}>
            <Txt size={14.5} color={t.p.muted} style={{ textAlign: "center" }}>{t.say("nothing_planned")}</Txt>
          </View>
        ) : null}
      </View>
    </LedgeCard>
  );
}

// Things she chose not to do today. They count as handled; "Do today" brings one back.
export function Pile({ tasks, open, onToggle, ...c }: Common & { tasks: Task[]; open: boolean; onToggle: () => void }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.p.card, borderRadius: 18, borderBottomWidth: 4, borderBottomColor: t.p.line }}>
      <Pressable
        accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
        accessibilityLabel={`${t.say("pile")}, ${tasks.length}. ${open ? t.say("pile_close") : t.say("pile_open")}`}
        onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 16 }}
      >
        <Txt kind="display" size={16}>{t.say("pile")}</Txt>
        <View style={{ backgroundColor: t.p.line, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 1 }}>
          <Txt w={800} size={13.5}>{String(tasks.length)}</Txt>
        </View>
        <Txt w={700} size={13.5} color={t.p.muted} style={{ marginLeft: "auto" }}>
          {open ? t.say("pile_close") : tasks.length ? t.say("pile_open") : t.say("pile_hint")}
        </Txt>
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 6, paddingBottom: 8 }}>
          {tasks.map((task) => <TaskRow key={task.id} task={task} today={c.today} showTimes={c.showTimes} showDate a={c.a} />)}
          {!tasks.length ? <Txt size={14.5} color={t.p.muted} style={{ textAlign: "center", padding: 10 }}>{t.say("pile_empty")}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

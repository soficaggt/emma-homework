// The details box (opened with the heart): color, due date, note, how long, a tiny first step, and moving.
// It only offers what the database lets her change. For anything a teacher, a platform or Sofia set,
// it says who set it. (The database enforces this either way; the buttons just do not lie.)
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { addDays, dayName, shortDate, shortDay } from "@/logic/dates";
import {
  canEditDue, dueTargets, formatMinutes, isLocked, moveTargets, parseMinutes, TYPE_NAMES, type Task, type TaskPatch,
} from "@/logic/tasks";
import { useTheme } from "@/theme/ThemeProvider";
import { HeartIcon, LedgeCard, Pill, Txt } from "./ui";

const WHO: Record<Task["source"], string> = { student: "You", coach: "Sofia", template: "The weekly plan", helper: "The helper", platform: "Your school site" };

function Field({ label, value, onSave, placeholder, keyboard }: {
  label: string; value: string; onSave: (v: string) => void; placeholder?: string; keyboard?: "default" | "numbers-and-punctuation";
}) {
  const t = useTheme();
  const [v, setV] = useState(value);
  const sent = useRef(value);   // the last text we saved, so Enter followed by blur does not save twice
  useEffect(() => { setV(value); sent.current = value; }, [value]);
  const save = () => { const x = v.trim(); if (x !== sent.current) { sent.current = x; onSave(x); } };
  return (
    <View style={{ gap: 4 }}>
      <Txt kind="display" size={14} color={t.p.muted}>{label}</Txt>
      <TextInput
        value={v} onChangeText={setV} placeholder={placeholder} placeholderTextColor={t.p.muted} keyboardType={keyboard}
        accessibilityLabel={label} returnKeyType="done" maxLength={200}
        onBlur={save} onSubmitEditing={save}
        style={[{ minHeight: 48, borderWidth: 2, borderColor: t.p.line, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: t.p.fg, backgroundColor: t.p.card }, t.body(600)]}
      />
    </View>
  );
}

export function DetailsSheet({ task, today, dayTasks, onClose, onPatch, onMoveInDay }: {
  task: Task | null; today: string; dayTasks: Task[]; onClose: () => void;
  onPatch: (id: string, patch: TaskPatch) => void; onMoveInDay: (id: string, dir: -1 | 1) => void;
}) {
  const t = useTheme();
  if (!task) return null;
  const sys = t.theme.colorSystem;
  const label = (d: string) => (d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : `${shortDay(d)} ${Number(d.slice(8))}`);
  const label2 = (s: string) => <Txt kind="display" size={14} color={t.p.muted}>{s}</Txt>;
  const dueOk = canEditDue(task);
  const idx = dayTasks.filter((x) => !isLocked(x) || x.id === task.id).findIndex((x) => x.id === task.id);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable accessibilityLabel={t.say("close")} onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(20,14,40,0.5)", justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Pressable onPress={() => undefined} style={{ width: "100%", maxWidth: 480, maxHeight: "92%" }} accessible={false}>
          <LedgeCard pad={0}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
              <Txt kind="display" w={700} size={22} accessibilityRole="header">{task.title}</Txt>

              {sys.steps.length ? (
                <View style={{ gap: 8 }}>
                  {label2(t.say("details_color"))}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {sys.steps.map((s, i) => {
                      const l = t.lookAt(task, i);
                      const current = task.color_step === i;
                      return (
                        <Pressable key={s.key + i} accessibilityRole="button" accessibilityLabel={`${s.name}, ${s.meaning}`} accessibilityState={{ selected: current }} aria-selected={current}
                          onPress={() => onPatch(task.id, { color_step: i })}
                          style={{ width: "23%", minWidth: 76, minHeight: 76, alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 14, gap: 2,
                            backgroundColor: current ? t.p.line : "transparent", borderWidth: current ? 2 : 0, borderColor: t.p.fg }}>
                          <HeartIcon fill={l.heart} stroke={l.heartStroke} size={38} />
                          <Txt size={12} w={800} color={t.p.muted} style={{ textAlign: "center" }}>{s.meaning}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pill tone="ghost" small disabled={task.color_step === null}
                    label={task.color_step === null ? t.say("details_auto_now", { meaning: t.meaningOf(task, today).toLowerCase() }) : t.say("details_auto")}
                    onPress={() => onPatch(task.id, { color_step: null })} />
                </View>
              ) : null}

              <View style={{ gap: 8 }}>
                {label2(t.say("details_due"))}
                {dueOk ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <Pill small label={t.say("details_none")} pressed={!task.due_date} onPress={() => onPatch(task.id, { due_date: null })} />
                    {dueTargets(today).map((d) => (
                      <Pill key={d} small label={label(d)} a11y={`${dayName(d)} ${shortDate(d)}`} pressed={task.due_date === d} onPress={() => onPatch(task.id, { due_date: d })} />
                    ))}
                  </View>
                ) : (
                  <Txt size={15}>
                    {(task.due_date ? `${dayName(task.due_date)}, ${shortDate(task.due_date)}. ` : "No due date. ") + t.say("set_by", { who: WHO[task.source] })}
                  </Txt>
                )}
              </View>

              <Field label={t.say("details_note")} value={task.note ?? ""} onSave={(v) => onPatch(task.id, { note: v || null })} />
              <Field label={t.say("details_minutes")} value={task.minutes ? String(task.minutes) : ""} keyboard="numbers-and-punctuation" placeholder={formatMinutes(30)}
                onSave={(v) => { const m = parseMinutes(v); if (m !== undefined) onPatch(task.id, { minutes: m }); }} />
              <Field label={t.say("details_first_step")} value={task.first_step ?? ""} placeholder={t.say("first_step_placeholder")}
                onSave={(v) => onPatch(task.id, { first_step: v || null })} />

              <View style={{ gap: 4 }}>
                {label2(t.say("details_type"))}
                <Txt size={15}>{TYPE_NAMES[task.type]}</Txt>
              </View>

              {!isLocked(task) ? (
                <View style={{ gap: 8 }}>
                  {label2(t.say("details_move"))}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {moveTargets(today).map((d) => (
                      <Pill key={d} small label={label(d)} a11y={`${dayName(d)} ${shortDate(d)}`} pressed={task.date === d && !task.not_today}
                        onPress={() => onPatch(task.id, { date: d, not_today: false })} />
                    ))}
                    <Pill small label={t.say("pile")} pressed={task.not_today} onPress={() => onPatch(task.id, { not_today: true })} />
                  </View>
                  {!task.not_today ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pill small label={t.say("details_up")} disabled={idx <= 0} onPress={() => onMoveInDay(task.id, -1)} />
                      <Pill small label={t.say("details_down")} disabled={idx < 0 || idx >= dayTasks.filter((x) => !isLocked(x) || x.id === task.id).length - 1} onPress={() => onMoveInDay(task.id, 1)} />
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Pill tone="accent" label={t.say("close")} onPress={onClose} />
              </View>
            </ScrollView>
          </LedgeCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

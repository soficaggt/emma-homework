// One task on the list. Tap the title or note to change it right there; the heart opens the details.
import { useRef, useState } from "react";
import { Pressable, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { dayName } from "@/logic/dates";
import { canDelete, canSkip, dueChip, formatMinutes, isPlan, type Task } from "@/logic/tasks";
import { useTheme } from "@/theme/ThemeProvider";
import { ArrowIcon, HeartIcon, IconButton, MIN_TAP, Txt, XIcon } from "./ui";

// Text that turns into an input when tapped, and saves when she presses Enter or taps away.
export function InlineText({ value, placeholder, label, onSave, size = 16, weight = 800, color, keyboard, empty, strike }: {
  value: string; placeholder?: string; label: string; onSave: (v: string) => void; size?: number; weight?: number;
  color?: string; keyboard?: KeyboardTypeOptions; empty?: string; strike?: boolean;
}) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const closed = useRef(true);   // Enter and losing focus both end an edit; only the first one saves
  const finish = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    setEditing(false);
    const v = draft.trim();
    if (save && v !== value) onSave(v);
    else setDraft(value);
  };
  if (editing) {
    return (
      <TextInput
        autoFocus selectTextOnFocus value={draft} onChangeText={setDraft} placeholder={placeholder} placeholderTextColor={t.p.muted}
        keyboardType={keyboard} accessibilityLabel={label} returnKeyType="done" blurOnSubmit
        onSubmitEditing={() => finish(true)} onBlur={() => finish(true)}
        style={[{ color: t.p.fg, backgroundColor: t.p.card, borderWidth: 2, borderColor: t.p.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minHeight: 36, fontSize: size }, t.body(700)]}
      />
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || empty || "empty"}`}
      style={{ minHeight: 44, justifyContent: "center" }}
      onPress={() => { setDraft(value); closed.current = false; setEditing(true); }}>
      <Txt w={weight} size={size} color={color} style={strike ? { textDecorationLine: "line-through", opacity: 0.5 } : undefined}>
        {value || empty || ""}
      </Txt>
    </Pressable>
  );
}

export type RowActions = {
  onCheck: (t: Task) => void; onSkip: (t: Task) => void; onDoToday: (t: Task) => void; onDetails: (t: Task) => void;
  onDelete: (t: Task) => void; onTitle: (t: Task, v: string) => void;
};

export function TaskRow({ task, today, showTimes, showDate, isNext, a }: {
  task: Task; today: string; showTimes: boolean; showDate?: boolean; isNext?: boolean; a: RowActions;
}) {
  const t = useTheme();
  const look = t.look(task, today);
  const plan = isPlan(task);
  const chip = dueChip(task, today);
  const editable = !task.done && !plan;
  const R = t.theme.shapes;
  const chipStyle = { paddingHorizontal: 8, paddingVertical: 1, borderRadius: R.pill, backgroundColor: look.chip };

  return (
    <View style={isNext ? { padding: 3, borderRadius: R.task + 3, borderWidth: 3, borderColor: t.p.accent } : { padding: 6 }}>
      <View
        style={{
          flexDirection: "row", alignItems: "center", backgroundColor: look.bg, borderRadius: R.task, paddingVertical: 6, paddingLeft: 2, paddingRight: MIN_TAP - 2,
          borderWidth: look.edge ? 2 : 0, borderColor: look.edge, opacity: plan ? 0.9 : 1,
        }}
      >
        {plan ? (
          <View style={{ width: MIN_TAP, height: MIN_TAP, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: look.strong }} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="checkbox" accessibilityLabel={task.title} accessibilityState={{ checked: task.done }} aria-checked={task.done}
            onPress={() => a.onCheck(task)} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: 26, height: 26, borderRadius: R.check, borderWidth: 2.5, borderColor: look.box, backgroundColor: task.done ? look.box : t.p.card, alignItems: "center", justifyContent: "center" }}>
              {task.done ? <View style={{ width: 7, height: 13, borderColor: "#fff", borderRightWidth: 3, borderBottomWidth: 3, transform: [{ rotate: "45deg" }, { translateY: -1 }] }} /> : null}
            </View>
          </Pressable>
        )}

        <View style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 4, paddingRight: 4 }}>
          {editable ? (
            <InlineText value={task.title} label="Rename" onSave={(v) => a.onTitle(task, v)} color={look.ink} />
          ) : (
            <Txt w={800} color={look.ink} style={task.done ? { textDecorationLine: "line-through", opacity: 0.5 } : undefined}>{task.title}</Txt>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {chip ? (
              <View style={[chipStyle, chip.kind === "today" && { backgroundColor: t.p.alert }, chip.kind === "late" && { backgroundColor: t.p.fg }]}>
                <Txt w={800} size={12.5} color={chip.kind === "today" ? t.p.alertInk : chip.kind === "late" ? t.p.card : look.ink}>
                  {t.say(chip.kind === "tonight" ? "due_tonight" : chip.kind === "today" ? "due_today" : chip.kind === "late" ? "was_due" : "due_on", { day: chip.day })}
                </Txt>
              </View>
            ) : null}
            {showDate || task.not_today ? <Txt size={13} color={look.ink}>{t.say("from_day", { day: dayName(task.date) })}</Txt> : null}
            {task.note ? (
              <Txt size={13} w={600} color={look.ink} style={task.done ? { textDecorationLine: "line-through", opacity: 0.5 } : undefined}>{task.note}</Txt>
            ) : null}
            {showTimes && task.minutes ? (
              <View style={[chipStyle, { paddingVertical: 3, paddingHorizontal: 10 }]}><Txt kind="display" size={13.5} color={look.ink}>{formatMinutes(task.minutes)}</Txt></View>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {task.not_today && !task.done ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t.say("do_today") + " " + task.title} onPress={() => a.onDoToday(task)}
              style={{ minHeight: MIN_TAP, justifyContent: "center", paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: t.p.card, marginRight: 4 }}>
              <Txt kind="display" size={13}>{t.say("do_today")}</Txt>
            </Pressable>
          ) : null}
          {canSkip(task) ? (
            <IconButton label={`${t.say("pile")}: ${task.title}`} onPress={() => a.onSkip(task)}><ArrowIcon color={look.strong} /></IconButton>
          ) : null}
          <IconButton label={`${t.say("details_title")}: ${task.title}`} onPress={() => a.onDetails(task)}>
            <HeartIcon fill={look.heart} stroke={look.heartStroke} />
          </IconButton>
        </View>

        {canDelete(task) ? (
          <IconButton label={`Delete ${task.title}`} onPress={() => a.onDelete(task)} style={{ position: "absolute", top: 0, right: 0 }}>
            <View style={{ opacity: 0.45 }}><XIcon color={look.ink} /></View>
          </IconButton>
        ) : null}
      </View>
    </View>
  );
}

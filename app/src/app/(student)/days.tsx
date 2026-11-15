// The Days checklist. Today is the default, with one clear next task and a first-step prompt.
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Confirm } from "@/components/Overlays";
import { DaySection, Pile } from "@/components/DaySection";
import { DetailsSheet } from "@/components/DetailsSheet";
import { NextCard } from "@/components/NextCard";
import type { RowActions } from "@/components/TaskRow";
import { ClockIcon, IconButton, Pill, Txt } from "@/components/ui";
import { addDays, shortDate } from "@/logic/dates";
import { buildBoard, pickNext, reorder, type Task } from "@/logic/tasks";
import { useFrame } from "@/lib/frame";
import { useTheme } from "@/theme/ThemeProvider";

const TIMES_KEY = "homework.showTimes";
const RANGES: { n: 1 | 3 | 7; key: string }[] = [{ n: 1, key: "range_today" }, { n: 3, key: "range_3" }, { n: 7, key: "range_week" }];

export default function Days() {
  const t = useTheme();
  const { board, setKicker, say } = useFrame();
  const { tasks, today, noProof, loading, update, updateMany, add, reload } = board;
  // Today is the default every time she opens the app. The wider views are one tap away.
  const [count, setCount] = useState<1 | 3 | 7>(1);
  const [showTimes, setShowTimes] = useState(false);
  const [pileOpen, setPileOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  useEffect(() => { AsyncStorage.getItem(TIMES_KEY).then((v) => setShowTimes(v === "1")).catch(() => undefined); }, []);
  const toggleTimes = () => { const v = !showTimes; setShowTimes(v); AsyncStorage.setItem(TIMES_KEY, v ? "1" : "0").catch(() => undefined); };

  useEffect(() => {
    setKicker(count === 1 ? shortDate(today) : t.say("range_label", { from: shortDate(today), to: shortDate(addDays(today, count - 1)) }));
  }, [count, today, setKicker, t]);

  const b = useMemo(() => buildBoard(tasks, today, count, noProof), [tasks, today, count, noProof]);
  const next = useMemo(() => pickNext(tasks, today, noProof), [tasks, today, noProof]);
  const nextId = next.kind === "task" ? next.task.id : undefined;

  const actions: RowActions = useMemo(() => ({
    // Checking off is done by the server, with proof, in the next build step. Until then it only explains itself.
    onCheck: () => say("check_soon"),
    onSkip: (x) => void update(x.id, { not_today: true }),
    onDoToday: (x) => void update(x.id, { not_today: false, date: today }),
    onDetails: (x) => setDetailsId(x.id),
    onDelete: (x) => setDeleting(x),
    onTitle: (x, v) => { if (v) void update(x.id, { title: v }); },
  }), [say, update, today]);

  const onAdd = useCallback(async (date: string, title: string) => !!(await add(date, title, 30)), [add]);
  const details = detailsId ? tasks.find((x) => x.id === detailsId && !x.deleted) ?? null : null;
  const dayTasks = details ? tasks.filter((x) => !x.deleted && x.date === details.date && !x.not_today) : [];

  if (loading) return <Txt color={t.p.muted} style={{ textAlign: "center", padding: 30 }}>{t.say("loading")}</Txt>;

  const common = { today, showTimes, nextId, a: actions };
  return (
    <View style={{ gap: 20 }}>
      {board.notice?.key === "load_failed" && !tasks.length ? (
        <View style={{ alignItems: "center", gap: 10, padding: 20 }}>
          <Txt style={{ textAlign: "center" }}>{t.say("load_failed")}</Txt>
          <Pill tone="accent" label={t.say("retry")} onPress={() => void reload()} />
        </View>
      ) : null}

      <NextCard next={next} today={today} showTimes={showTimes} onSaveFirstStep={(id, v) => void update(id, { first_step: v || null })} />

      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}>
        <View style={{ flexDirection: "row", backgroundColor: t.p.card, borderRadius: t.theme.shapes.pill, padding: 4, borderBottomWidth: 4, borderBottomColor: t.p.line }}>
          {RANGES.map((r) => (
            <Pill key={r.n} small tone="ghost" label={t.say(r.key)} pressed={count === r.n} onPress={() => setCount(r.n)} />
          ))}
        </View>
        <IconButton label={t.say(showTimes ? "hide_times" : "show_times")} onPress={toggleTimes}
          style={{ borderRadius: 22, backgroundColor: showTimes ? t.p.accent : t.p.card, borderBottomWidth: 4, borderBottomColor: t.p.line }}>
          <ClockIcon color={showTimes ? t.p.accentInk : t.p.muted} />
        </IconButton>
      </View>

      <Pile tasks={b.pile} open={pileOpen} onToggle={() => setPileOpen(!pileOpen)} {...common} />

      {b.earlier.length ? <DaySection earlier title={t.say("earlier")} tasks={b.earlier} {...common} /> : null}
      {b.days.map((d) => <DaySection key={d.date} date={d.date} tasks={d.tasks} onAdd={onAdd} {...common} />)}

      <DetailsSheet
        task={details} today={today} dayTasks={dayTasks} onClose={() => setDetailsId(null)}
        onPatch={(id, p) => void update(id, p)}
        onMoveInDay={(id, dir) => void updateMany(reorder(dayTasks, id, dir))}
      />
      {deleting ? (
        <Confirm
          title={t.say("delete_title", { title: deleting.title })} message={t.say("delete_msg")} yes={t.say("delete_yes")}
          onCancel={() => setDeleting(null)}
          onYes={() => { const x = deleting; setDeleting(null); void update(x.id, { deleted: true }); }}
        />
      ) : null}
    </View>
  );
}

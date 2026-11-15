// The checklist's state: the tasks, today, and every change she makes. A change shows at once and is
// saved in the background; if the database says no, it is put back and a calm message is shown.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { getRepo } from "@/data";
import { RepoError, type Coins } from "@/data/repo";
import { todayIn } from "@/logic/dates";
import type { Task, TaskPatch } from "@/logic/tasks";

export type Notice = { key: "save_failed" | "forbidden" | "load_failed"; id: number } | null;

export function useBoard(studentId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [noProof, setNoProof] = useState<string[]>(["flex", "fixed"]);
  const [zone, setZone] = useState("America/New_York");
  const [today, setToday] = useState(() => todayIn("America/New_York"));
  const [coins, setCoins] = useState<Coins | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  const todayRef = useRef(today);
  todayRef.current = today;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const noticeId = useRef(0);
  const tell = useCallback((key: NonNullable<Notice>["key"]) => setNotice({ key, id: ++noticeId.current }), []);

  const load = useCallback(async () => {
    const t = todayIn(zoneRef.current);
    if (t !== todayRef.current) setToday(t);
    try {
      const b = await getRepo().tasks(studentId, t);
      setTasks(b.tasks);
      setNoProof(b.noProof);
      setLoading(false);
      getRepo().coins(studentId).then(setCoins).catch(() => { /* the counter just stays as it was */ });
    } catch {
      setLoading(false);
      tell("load_failed");
    }
  }, [studentId, tell]);

  // First load: her time zone decides what "today" is.
  useEffect(() => {
    let alive = true;
    getRepo().timeZone(studentId).then((z) => {
      if (!alive) return;
      zoneRef.current = z;
      setZone(z);
      setToday(todayIn(z));
    }).catch(() => { /* keep New York */ }).finally(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [studentId, load]);

  // Stay fresh: when something changes elsewhere (Sofia, the server), when she comes back to the app,
  // and when midnight passes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => void load(), 350); };
    const unsub = getRepo().subscribe(studentId, soon);
    const app = AppState.addEventListener("change", (s) => { if (s === "active") soon(); });
    const onVisible = () => { if (document.visibilityState === "visible") soon(); };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", onVisible);
    const tick = setInterval(() => { if (todayIn(zoneRef.current) !== todayRef.current) soon(); }, 60_000);
    return () => {
      unsub(); app.remove(); clearInterval(tick); clearTimeout(timer);
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", onVisible);
    };
  }, [studentId, load]);

  const update = useCallback(async (id: string, patch: TaskPatch) => {
    const before = tasksRef.current;
    setTasks(before.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      await getRepo().update(id, patch);
    } catch (e) {
      const old = before.find((x) => x.id === id);
      if (old) {
        const back = Object.fromEntries(Object.keys(patch).map((k) => [k, old[k as keyof Task]]));
        setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, ...back } : t)));
      }
      tell(e instanceof RepoError && e.kind === "forbidden" ? "forbidden" : "save_failed");
    }
  }, [tell]);

  // Several changes at once (renumbering a day). Rolled back together if any one is refused.
  const updateMany = useCallback(async (patches: { id: string; sort_order: number }[]) => {
    if (!patches.length) return;
    const before = tasksRef.current;
    const map = new Map(patches.map((p) => [p.id, p.sort_order]));
    setTasks(before.map((t) => (map.has(t.id) ? { ...t, sort_order: map.get(t.id)! } : t)));
    try {
      await Promise.all(patches.map((p) => getRepo().update(p.id, { sort_order: p.sort_order })));
    } catch {
      setTasks(before);
      tell("save_failed");
    }
  }, [tell]);

  const add = useCallback(async (date: string, title: string, minutes: number | null) => {
    const sameDay = tasksRef.current.filter((t) => t.date === date);
    const sort_order = Math.max(0, ...sameDay.map((t) => t.sort_order)) + 10;
    try {
      const t = await getRepo().add({ student_id: studentId, date, title, minutes, sort_order });
      setTasks((cur) => [...cur.filter((x) => x.id !== t.id), t]);
      return t;
    } catch (e) {
      tell(e instanceof RepoError && e.kind === "forbidden" ? "forbidden" : "save_failed");
      return null;
    }
  }, [studentId, tell]);

  return { tasks, noProof, today, coins, loading, notice, update, updateMany, add, reload: load };
}

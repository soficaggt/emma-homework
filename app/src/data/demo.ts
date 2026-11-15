// DEVELOPMENT ONLY. A pretend database so the screens can be looked at without an account.
// It is switched on only when the app runs in development with EXPO_PUBLIC_DEMO=1 (see index.ts),
// and is not included in a production build. It follows the same rules the real database does for a
// student (no editing finished tasks, no deleting or re-dating tasks someone else set), so the
// calm error messages can be seen too.
import emma from "../../theme-data/emma.theme.json";
import { addDays, todayIn } from "@/logic/dates";
import type { Task, TaskPatch } from "@/logic/tasks";
import type { ThemeRow } from "@/theme/types";
import { RepoError, type Repo } from "./repo";

const STUDENT = "demo-student";
let seq = 100;
const mk = (today: string, o: Partial<Task> & { day?: number }): Task => {
  const { day = 0, ...rest } = o;
  const date = addDays(today, day);
  return {
    id: `demo-${++seq}`, student_id: STUDENT, date, original_date: date, title: "Task", note: null, minutes: null, type: "school",
    color_step: null, sort_order: seq, done: false, done_at: null, due_date: null, not_today: false, coins: 3, deleted: false,
    source: "coach", first_step: null, estimated_minutes: null, verified_by: null, ...rest,
  };
};

function fixtures(today: string): Task[] {
  return [
    mk(today, { title: "RSM Geometry class", type: "fixed", minutes: 90, sort_order: 1, source: "template", coins: 0 }),
    mk(today, { title: "Latin vocab, list 7", minutes: 20, due_date: addDays(today, 1), sort_order: 10, first_step: "Open the vocab book to list 7" }),
    mk(today, { title: "Hobbit, chapter 9", minutes: 30, note: "answer the 3 questions", due_date: addDays(today, 2), sort_order: 20, source: "platform" }),
    mk(today, { title: "Bio textbook notes", minutes: 25, due_date: addDays(today, 4), sort_order: 30 }),
    mk(today, { title: "Math worksheet", minutes: 15, done: true, done_at: new Date().toISOString(), due_date: today, sort_order: 5 }),
    mk(today, { title: "Dinner", type: "flex", minutes: 40, sort_order: 90, source: "template", coins: 1 }),
    mk(today, { title: "Study for the History test", minutes: 30, due_date: addDays(today, 3), sort_order: 40, source: "student", coins: 0 }),
    mk(today, { title: "Read the science article", minutes: 15, not_today: true, due_date: addDays(today, 6), sort_order: 50 }),
    mk(today, { day: -1, title: "Physics lab questions", minutes: 25, due_date: today, sort_order: 10, source: "platform" }),
    mk(today, { day: 1, title: "Robotics", type: "fixed", minutes: 120, sort_order: 1, source: "template", coins: 0 }),
    mk(today, { day: 1, title: "Latin quiz", type: "fixed", due_date: addDays(today, 1), sort_order: 2, source: "coach", coins: 0 }),
    mk(today, { day: 1, title: "Algebra problem set", minutes: 30, due_date: addDays(today, 3), sort_order: 10, source: "platform" }),
    mk(today, { day: 2, title: "Hobbit, chapter 10", minutes: 30, due_date: addDays(today, 5), sort_order: 10 }),
    mk(today, { day: 2, title: "Dinner", type: "flex", minutes: 40, sort_order: 90, source: "template", coins: 1 }),
  ];
}

export function makeDemoRepo(): Repo {
  let tasks: Task[] | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const zone = "America/New_York";
  const ensure = () => (tasks ??= fixtures(todayIn(zone)));
  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));

  return {
    timeZone: () => delay(zone),
    theme: () => delay(emma as unknown as ThemeRow),
    tasks: () => delay({ tasks: ensure().map((t) => ({ ...t })), noProof: ["flex", "fixed"] }),
    coins: () => delay({ spendable: 12, waiting: 4 }),
    async update(id: string, patch: TaskPatch) {
      // For trying the error messages by hand: set window.__demoFail = "forbidden" or "network" in the browser console.
      const fail = (globalThis as { __demoFail?: string }).__demoFail;
      if (fail) throw new RepoError(fail === "network" ? "network" : "forbidden", "demo failure");
      const t = ensure().find((x) => x.id === id);
      if (!t || t.done) throw new RepoError("forbidden", "finished");
      if ("due_date" in patch && patch.due_date !== t.due_date && t.source !== "student") throw new RepoError("forbidden", "set by its source");
      if (patch.deleted && t.source !== "student") throw new RepoError("forbidden", "not yours to delete");
      Object.assign(t, patch);
      notify();
      await delay(0);
    },
    async add(row) {
      const t = mk(todayIn(zone), { title: row.title, date: row.date, original_date: row.date, minutes: row.minutes, sort_order: row.sort_order, source: "student", coins: 0 });
      ensure().push(t);
      notify();
      return delay({ ...t });
    },
    subscribe(_id, cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  };
}

export const DEMO_STUDENT = { id: STUDENT, firstName: "Emma" };

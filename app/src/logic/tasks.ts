// The rules of the checklist, with no screen code in them so they can be tested on their own.
import { addDays, daysBetween, shortDate, shortDay } from "./dates";

export type TaskType = "test" | "school" | "hunter" | "rsm" | "fixed" | "flex";
export type Task = {
  id: string; student_id: string; date: string; original_date: string | null;
  title: string; note: string | null; minutes: number | null; type: TaskType;
  color_step: number | null; sort_order: number; done: boolean; done_at: string | null;
  due_date: string | null; not_today: boolean; coins: number; deleted: boolean;
  source: "student" | "coach" | "template" | "helper" | "platform";
  first_step: string | null; estimated_minutes: number | null; verified_by: string | null;
};

export const TYPE_NAMES: Record<TaskType, string> = {
  test: "Test prep", school: "School homework", hunter: "Hunter", rsm: "RSM", fixed: "Plan", flex: "Break",
};

export const TASK_COLUMNS =
  "id, student_id, date, original_date, title, note, minutes, type, color_step, sort_order, done, done_at, " +
  "due_date, not_today, coins, deleted, source, first_step, estimated_minutes, verified_by";

// What a student's own login is allowed to write on a task. The database enforces the same list
// (supabase/migrations ..0200_homework.sql); a test compares the two so they cannot drift apart.
export const STUDENT_INSERT_COLUMNS = ["student_id", "date", "title", "note", "due_date", "minutes", "color_step", "sort_order", "first_step", "start_plan", "estimated_minutes"] as const;
export const STUDENT_UPDATE_COLUMNS = ["title", "note", "date", "due_date", "minutes", "color_step", "sort_order", "not_today", "deleted", "first_step", "start_plan", "estimated_minutes"] as const;
export type TaskPatch = Partial<Pick<Task, "title" | "note" | "date" | "due_date" | "minutes" | "color_step" | "sort_order" | "not_today" | "deleted" | "first_step" | "estimated_minutes">>;

export const isPlan = (t: Pick<Task, "type">) => t.type === "fixed";
export const isFlex = (t: Pick<Task, "type">) => t.type === "flex";
// Classes and dinner stay where they are.
export const isLocked = (t: Pick<Task, "type">) => isPlan(t) || isFlex(t);
// A test or due marker lives on the calendar, never on the daily list.
export const isMarker = (t: Task) => isPlan(t) && !!t.due_date && t.due_date === t.date;

// The buttons the app shows follow what the database allows. The database is what actually enforces it.
export const canEditDue = (t: Task) => t.source === "student" && !t.done;
export const canDelete = (t: Task) => t.source === "student" && !t.done;
export const canEdit = (t: Task) => !t.done && !isPlan(t);
export const canSkip = (t: Task) => !t.done && !t.not_today && !isLocked(t);

export const byOrder = (a: Task, b: Task) => a.sort_order - b.sort_order || a.id.localeCompare(b.id);
// Finished things sink to the bottom of their day.
const doneLast = (a: Task, b: Task) => Number(a.done) - Number(b.done) || byOrder(a, b);

export type DayBlock = { date: string; tasks: Task[] };
export type Board = { earlier: Task[]; days: DayBlock[]; pile: Task[] };

export function buildBoard(all: Task[], today: string, count: number, noProof: string[] = ["flex", "fixed"]): Board {
  const live = all.filter((t) => !t.deleted && !isMarker(t));
  const earlier = live
    .filter((t) => t.date < today && !t.done && !t.not_today && !noProof.includes(t.type))
    .sort((a, b) => a.date.localeCompare(b.date) || byOrder(a, b));
  const days: DayBlock[] = [];
  for (let i = 0; i < count; i++) {
    const d = addDays(today, i);
    days.push({ date: d, tasks: live.filter((t) => t.date === d && !t.not_today).sort(doneLast) });
  }
  const pile = live.filter((t) => t.not_today && !t.done).sort((a, b) => a.date.localeCompare(b.date) || byOrder(a, b));
  return { earlier, days, pile };
}

export type Progress = { done: number; total: number; share: number };
// Plans are never checkable, so they never count.
export function progress(tasks: Task[]): Progress {
  const check = tasks.filter((t) => !isPlan(t));
  const done = check.filter((t) => t.done).length;
  return { done, total: check.length, share: check.length ? done / check.length : 0 };
}

export type Next =
  | { kind: "task"; task: Task; from: "today" | "earlier" }
  | { kind: "all_done" }
  | { kind: "none" };

// One clear next thing: the first unfinished homework of today, in the order she set. Dinner and
// breaks are never "next". Only if today is clear does something left over from an earlier day come up.
export function pickNext(all: Task[], today: string, noProof: string[] = ["flex", "fixed"]): Next {
  const live = all.filter((t) => !t.deleted && !isMarker(t) && !isPlan(t));
  const todays = live.filter((t) => t.date === today && !t.not_today);
  const open = todays.filter((t) => !t.done && !isFlex(t)).sort(byOrder);
  if (open.length) return { kind: "task", task: open[0], from: "today" };
  const left = live.filter((t) => t.date < today && !t.done && !t.not_today && !noProof.includes(t.type))
    .sort((a, b) => a.date.localeCompare(b.date) || byOrder(a, b));
  if (left.length) return { kind: "task", task: left[0], from: "earlier" };
  return todays.some((t) => !isFlex(t)) || live.some((t) => t.date === today && t.not_today) ? { kind: "all_done" } : { kind: "none" };
}

export type DueChip = { kind: "tonight" | "today" | "late" | "later"; day: string };
export function dueChip(t: Task, today: string): DueChip | null {
  if (!t.due_date) return null;
  if (isPlan(t) && t.due_date === t.date) return null;
  if (t.due_date === t.date && !t.done) return { kind: t.due_date === today ? "today" : "tonight", day: "" };
  if (t.due_date === today) return { kind: "today", day: "" };
  if (t.due_date < today && !t.done) return { kind: "late", day: shortDay(t.due_date) };
  return { kind: "later", day: daysBetween(today, t.due_date) < 7 ? shortDay(t.due_date) : shortDate(t.due_date) };
}

// "45", "45 min", "1h", "1.5 hrs", "1h 30m" -> minutes. Empty -> null. Nonsense -> undefined.
export function parseMinutes(input: string): number | null | undefined {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return clampMin(parseInt(s, 10));
  let m = 0, hit = false;
  const h = s.match(/([\d.]+)\s*(hrs?|hours?|h)\b/); if (h) { m += parseFloat(h[1]) * 60; hit = true; }
  const mm = s.match(/(\d+)\s*(mins?|minutes?|m)\b/); if (mm) { m += parseInt(mm[1], 10); hit = true; }
  return hit && Number.isFinite(m) ? clampMin(Math.round(m)) : undefined;
}
const clampMin = (n: number) => Math.min(600, Math.max(0, n));

export function formatMinutes(m: number | null): string {
  if (!m) return "";
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h} hr ${r} min` : `${h} hr`) : `${m} min`;
}
export function formatTotal(m: number): string {
  if (!m) return "";
  const h = m / 60;
  return h >= 1 ? `${Math.round(h * 4) / 4} ${h === 1 ? "hr" : "hrs"} total` : `${m} min total`;
}
export const totalMinutes = (tasks: Task[]) => tasks.reduce((s, t) => s + (isPlan(t) ? 0 : t.minutes ?? 0), 0);

// New order for one day after moving a task up or down. Every task in the day gets a clean number,
// so tasks that all started at 0 still move. Returns only what changed.
export function reorder(dayTasks: Task[], id: string, dir: -1 | 1): { id: string; sort_order: number }[] {
  const list = dayTasks.filter((t) => !isLocked(t) || t.id === id).slice().sort(doneLast);
  const i = list.findIndex((t) => t.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return [];
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((t, n) => ({ id: t.id, sort_order: (n + 1) * 10 })).filter((p) => list.find((t) => t.id === p.id)!.sort_order !== p.sort_order);
}

// The days a task can be moved to: today and the next six.
export const moveTargets = (today: string) => Array.from({ length: 7 }, (_, i) => addDays(today, i));
export const dueTargets = (today: string) => Array.from({ length: 14 }, (_, i) => addDays(today, i));

/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { addDays, dayName, shortDate, todayIn } from "@/logic/dates";
import {
  buildBoard, canDelete, canEditDue, canSkip, dueChip, formatMinutes, parseMinutes, pickNext, progress, reorder,
  STUDENT_INSERT_COLUMNS, STUDENT_UPDATE_COLUMNS, totalMinutes, type Task,
} from "@/logic/tasks";

const TODAY = "2026-11-16"; // a Monday
let n = 0;
const task = (o: Partial<Task> = {}): Task => ({
  id: "t" + String(++n).padStart(3, "0"), student_id: "s1", date: TODAY, original_date: TODAY, title: "Task", note: null, minutes: null,
  type: "school", color_step: null, sort_order: n, done: false, done_at: null, due_date: null, not_today: false, coins: 0,
  deleted: false, source: "student", first_step: null, estimated_minutes: null, verified_by: null, ...o,
});

describe("dates", () => {
  it("today follows her own time zone, not the device's", () => {
    // 02:30 UTC on Nov 16 is still the evening of Nov 15 in New York
    expect(todayIn("America/New_York", new Date("2026-11-16T02:30:00Z"))).toBe("2026-11-15");
    expect(todayIn("America/New_York", new Date("2026-11-16T05:30:00Z"))).toBe("2026-11-16");
    expect(todayIn("Not/AZone", new Date("2026-11-16T12:00:00Z"))).toBe("2026-11-16");
  });
  it("adds days across month ends and formats names", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(dayName(TODAY)).toBe("Monday");
    expect(shortDate(TODAY)).toBe("Nov 16");
  });
});

describe("the board", () => {
  it("shows today first, tests and due markers stay off the daily list, plans stay on it", () => {
    const marker = task({ type: "fixed", due_date: TODAY, date: TODAY, title: "Latin test" });
    const klass = task({ type: "fixed", title: "RSM Algebra" });
    const hw = task({ title: "Hobbit" });
    const b = buildBoard([marker, klass, hw], TODAY, 1);
    expect(b.days[0].tasks.map((x) => x.title)).toEqual(["RSM Algebra", "Hobbit"]);
  });
  it("finished tasks move to the bottom of their day", () => {
    const a = task({ title: "A", done: true, sort_order: 1 }), b = task({ title: "B", sort_order: 2 }), c = task({ title: "C", sort_order: 3 });
    expect(buildBoard([a, b, c], TODAY, 1).days[0].tasks.map((x) => x.title)).toEqual(["B", "C", "A"]);
  });
  it("Not today tasks leave their day and wait in the pile, and a deleted one is gone", () => {
    const p = task({ not_today: true }), d = task({ deleted: true });
    const b = buildBoard([p, d, task()], TODAY, 1);
    expect(b.pile).toEqual([p]);
    expect(b.days[0].tasks.length).toBe(1);
  });
  it("unfinished work from earlier days is listed, but not dinner or plans", () => {
    const old = task({ date: "2026-11-12", title: "Old hw" });
    const dinner = task({ date: "2026-11-12", type: "flex" });
    const doneOld = task({ date: "2026-11-12", done: true });
    expect(buildBoard([old, dinner, doneOld], TODAY, 1).earlier).toEqual([old]);
  });
  it("shows only as many days as asked for", () => {
    expect(buildBoard([], TODAY, 3).days.map((d) => d.date)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
  });
  it("progress ignores plans (they can never be checked)", () => {
    const p = progress([task({ type: "fixed" }), task({ done: true }), task()]);
    expect(p).toEqual({ done: 1, total: 2, share: 0.5 });
    expect(progress([]).share).toBe(0);
  });
});

describe("the one next task", () => {
  it("is the first unfinished homework of today in her order, never dinner or a plan", () => {
    const klass = task({ type: "fixed", sort_order: 0 });
    const dinner = task({ type: "flex", sort_order: 1 });
    const b = task({ title: "B", sort_order: 30 }), a = task({ title: "A", sort_order: 20 });
    const r = pickNext([klass, dinner, b, a], TODAY);
    expect(r.kind === "task" && r.task.title).toBe("A");
  });
  it("skips finished and Not today tasks", () => {
    const r = pickNext([task({ done: true, sort_order: 1 }), task({ not_today: true, sort_order: 2 }), task({ title: "Last", sort_order: 3 })], TODAY);
    expect(r.kind === "task" && r.task.title).toBe("Last");
  });
  it("when today is clear, something left over from an earlier day comes up", () => {
    const r = pickNext([task({ done: true }), task({ date: "2026-11-13", title: "Left over" })], TODAY);
    expect(r.kind === "task" && r.from).toBe("earlier");
  });
  it("says all done only when there was homework, and none when there is nothing", () => {
    expect(pickNext([task({ done: true })], TODAY).kind).toBe("all_done");
    expect(pickNext([task({ type: "flex" })], TODAY).kind).toBe("none");
    expect(pickNext([], TODAY).kind).toBe("none");
  });
});

describe("due chips", () => {
  it("matches the old wording rules", () => {
    expect(dueChip(task({ due_date: null }), TODAY)).toBeNull();
    expect(dueChip(task({ date: "2026-11-17", due_date: "2026-11-17" }), TODAY)).toEqual({ kind: "tonight", day: "" });
    expect(dueChip(task({ due_date: TODAY }), TODAY)).toEqual({ kind: "today", day: "" });
    expect(dueChip(task({ due_date: "2026-11-13", date: "2026-11-16" }), TODAY)).toEqual({ kind: "late", day: "Fri" });
    expect(dueChip(task({ due_date: "2026-11-19", date: "2026-11-16" }), TODAY)).toEqual({ kind: "later", day: "Thu" });
    expect(dueChip(task({ due_date: "2026-12-04", date: "2026-11-16" }), TODAY)).toEqual({ kind: "later", day: "Dec 4" });
    expect(dueChip(task({ type: "fixed", date: "2026-11-18", due_date: "2026-11-18" }), TODAY)).toBeNull();
  });
});

describe("minutes", () => {
  it("reads what a kid types", () => {
    expect(parseMinutes("45")).toBe(45);
    expect(parseMinutes("45 min")).toBe(45);
    expect(parseMinutes("1h")).toBe(60);
    expect(parseMinutes("1.5 hrs")).toBe(90);
    expect(parseMinutes("1h 30m")).toBe(90);
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes("a while")).toBeUndefined();
    expect(parseMinutes("99999")).toBe(600);
  });
  it("shows and adds them up", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(90)).toBe("1 hr 30 min");
    expect(formatMinutes(null)).toBe("");
    expect(totalMinutes([task({ minutes: 30 }), task({ minutes: 20 }), task({ type: "fixed", minutes: 90 })])).toBe(50);
  });
});

describe("what the buttons offer (the database is what really enforces it)", () => {
  it("only her own tasks can be deleted or get a new due date", () => {
    expect(canDelete(task({ source: "student" }))).toBe(true);
    expect(canDelete(task({ source: "platform" }))).toBe(false);
    expect(canDelete(task({ source: "template" }))).toBe(false);
    expect(canEditDue(task({ source: "coach" }))).toBe(false);
    expect(canDelete(task({ done: true }))).toBe(false);
  });
  it("classes, dinner and finished things cannot be pushed to Not today", () => {
    expect(canSkip(task())).toBe(true);
    expect(canSkip(task({ type: "fixed" }))).toBe(false);
    expect(canSkip(task({ type: "flex" }))).toBe(false);
    expect(canSkip(task({ done: true }))).toBe(false);
  });
});

describe("reordering", () => {
  it("moves a task and gives the whole day clean numbers, even when everything started at 0", () => {
    const a = task({ title: "A", sort_order: 0, id: "a" }), b = task({ title: "B", sort_order: 0, id: "b" }), c = task({ title: "C", sort_order: 0, id: "c" });
    const patches = reorder([a, b, c], "c", -1);
    expect(patches.length).toBeGreaterThan(0);
    const order = Object.fromEntries([a, b, c].map((t) => [t.id, patches.find((p) => p.id === t.id)?.sort_order ?? t.sort_order]));
    expect(order.c).toBeLessThan(order.b);
  });
  it("does nothing at the ends", () => {
    const a = task({ id: "a", sort_order: 10 }), b = task({ id: "b", sort_order: 20 });
    expect(reorder([a, b], "a", -1)).toEqual([]);
    expect(reorder([a, b], "b", 1)).toEqual([]);
  });
});

// The app may only write the columns the database lets a student write. Read straight from the migration.
describe("the app's write list matches the database's rule for a student", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261112000200_homework.sql", import.meta.url), "utf8");
  const tasksGuard = sql.slice(sql.indexOf("on public.tasks for each row execute function public.guard_columns("));
  const lists = (kind: "insert" | "update") =>
    JSON.parse(tasksGuard.match(new RegExp('"student":\\{[^}]*?"' + kind + '":(\\[[^\\]]*\\])'))![1]) as string[];
  it("insert", () => { expect([...STUDENT_INSERT_COLUMNS].sort()).toEqual([...lists("insert")].sort()); });
  it("update", () => { expect([...STUDENT_UPDATE_COLUMNS].sort()).toEqual([...lists("update")].sort()); });
});

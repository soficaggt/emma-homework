// Every read and write the checklist makes. In the real app all of it goes through Supabase with the
// student's own login, so the database's Row Level Security decides what she can see and change.
// The app never asks for more than she is allowed; if it did, the database would refuse.
import { supabase } from "@/lib/supabase";
import { addDays } from "@/logic/dates";
import { STUDENT_INSERT_COLUMNS, TASK_COLUMNS, type Task, type TaskPatch } from "@/logic/tasks";
import type { ThemeRow } from "@/theme/types";

export type RepoErrorKind = "forbidden" | "network" | "other";
export class RepoError extends Error {
  constructor(public kind: RepoErrorKind, message: string) { super(message); }
}

export type NewTask = { student_id: string; date: string; title: string; minutes: number | null; sort_order: number };
export type TaskBundle = { tasks: Task[]; noProof: string[] };
export type Coins = { spendable: number; waiting: number };

export interface Repo {
  timeZone(studentId: string): Promise<string>;
  theme(studentId: string): Promise<ThemeRow | null>;
  tasks(studentId: string, today: string): Promise<TaskBundle>;
  coins(studentId: string): Promise<Coins>;
  update(id: string, patch: TaskPatch): Promise<void>;
  add(row: NewTask): Promise<Task>;
  subscribe(studentId: string, onChange: () => void): () => void;
}

type PgError = { code?: string; message?: string } | null;
function fail(e: NonNullable<PgError>): never {
  const msg = e.message ?? "";
  if (e.code === "42501" || /row-level security|cannot be changed|cannot be set|not allowed to|set by its source/i.test(msg)) {
    throw new RepoError("forbidden", msg);
  }
  if (/failed to fetch|network|load failed|timeout/i.test(msg)) throw new RepoError("network", msg);
  throw new RepoError("other", msg);
}

const WINDOW_DAYS = 7;

export const supabaseRepo: Repo = {
  async timeZone(id) {
    const { data, error } = await supabase.from("profiles").select("time_zone").eq("id", id).maybeSingle();
    if (error) fail(error);
    return (data as { time_zone?: string } | null)?.time_zone ?? "America/New_York";
  },

  async theme(id) {
    const { data, error } = await supabase.from("themes")
      .select("name, theming_depth, palette, fonts, shapes, wording, page_names, currency, color_system")
      .eq("student_id", id).eq("active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) fail(error);
    return (data as ThemeRow | null) ?? null;
  },

  async tasks(id, today) {
    const end = addDays(today, WINDOW_DAYS - 1);
    const base = () => supabase.from("tasks").select(TASK_COLUMNS).eq("student_id", id).eq("deleted", false);
    const [win, earlier, pile, settings] = await Promise.all([
      base().gte("date", today).lte("date", end).limit(500),
      base().lt("date", today).eq("done", false).eq("not_today", false).limit(100),
      base().eq("not_today", true).eq("done", false).limit(200),
      supabase.from("student_settings").select("no_proof_types").eq("student_id", id).maybeSingle(),
    ]);
    for (const r of [win, earlier, pile]) if (r.error) fail(r.error);
    const seen = new Map<string, Task>();
    for (const r of [win, earlier, pile]) for (const t of (r.data ?? []) as unknown as Task[]) seen.set(t.id, t);
    const noProof = (settings.data as { no_proof_types?: string[] } | null)?.no_proof_types ?? ["flex", "fixed"];
    return { tasks: [...seen.values()], noProof };
  },

  // Display only. Which coins count, and when, is decided by the server in the rewards step.
  async coins(id) {
    const { data, error } = await supabase.from("ledger").select("amount, status").eq("student_id", id).in("status", ["held", "confirmed"]).limit(5000);
    if (error) fail(error);
    let spendable = 0, waiting = 0;
    for (const r of (data ?? []) as { amount: number; status: string }[]) {
      if (r.status === "confirmed") spendable += r.amount; else waiting += r.amount;
    }
    return { spendable: Math.max(0, spendable), waiting: Math.max(0, waiting) };
  },

  async update(id, patch) {
    const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select("id");
    if (error) fail(error);
    // A row the database will not let her touch (a finished task, say) comes back as zero rows, not an error.
    if (!data || data.length !== 1) throw new RepoError("forbidden", "no row updated");
  },

  async add(row) {
    // Only the columns a student may set. Coins stay at 0: her own tasks earn nothing until the
    // assignment check (step 5) or an adult sets their value.
    const body: Record<string, unknown> = {};
    for (const k of STUDENT_INSERT_COLUMNS) if (k in row) body[k] = (row as Record<string, unknown>)[k];
    const { data, error } = await supabase.from("tasks").insert(body).select(TASK_COLUMNS).single();
    if (error) fail(error);
    return data as unknown as Task;
  },

  subscribe(id, onChange) {
    const channel = supabase.channel(`tasks-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `student_id=eq.${id}` }, onChange)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  },
};

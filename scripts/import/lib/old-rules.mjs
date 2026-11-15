// The old site's own arithmetic (backend/Code.gs and index.html), re-done on the snapshot, so the
// import can be compared against what Emma's old screen shows. Read-only copies of the rules, not new rules.
import { addDays, monday, dayGap } from './util.mjs';

export const CATS = ['test', 'school', 'hunter', 'rsm', 'fixed', 'flex'];
export const GIFT_BOXES = ['2026-10-28'];                       // Code.gs: the box Sofia gave back by hand
const COIN_VALUE = { purple: 5, blue: 4, white: 3, pink: 3, orange: 2, yellow: 2, green: 2, gray: 1 };  // index.html
export const LADDER = ['purple', 'blue', 'white', 'pink', 'orange', 'yellow', 'green', 'gray'];       // index.html

export const checkable = t => !t.deleted && t.cat !== 'fixed';

// index.html priorityColor(): the color the old site picked when none was chosen.
export function priorityColor(t, today) {
  const ref = t.date < today ? today : t.date;
  if (t.cat === 'fixed') return 'purple';
  if (t.cat === 'flex') return 'yellow';
  if (!t.due) return t.cat === 'test' ? 'blue' : 'white';
  const gap = dayGap(ref, t.due);
  return gap <= 1 ? 'purple' : gap === 2 ? 'blue' : gap === 3 ? 'white' : gap === 4 ? 'pink' : gap === 5 ? 'orange' : gap === 6 ? 'yellow' : 'green';
}
// index.html coinsFor(): what finishing the task would have paid (dinner 1, else by color, default 3).
export function oldCoinsFor(t, today) {
  if (t.cat === 'flex') return 1;
  return COIN_VALUE[t.color || priorityColor(t, today)] || 3;
}

// Code.gs coins_(): finished, not deleted tasks plus the ledger (purchases are negative).
export function oldBalance(tasks, ledger) {
  return tasks.filter(t => t.done && !t.deleted).reduce((n, t) => n + (Number(t.coins) || 0), 0)
       + ledger.reduce((n, l) => n + (Number(l.amount) || 0), 0);
}

// Code.gs cleared_().
export function cleared(tasks, d) {
  const list = tasks.filter(t => checkable(t) && t.date === d);
  return list.length > 0 && list.every(t => t.done || t.pile);
}

// Code.gs quality_(), without the moved-off list (that lived in script properties, not in the Sheet).
export function quality(tasks, d) {
  const day = tasks.filter(t => checkable(t) && t.cat !== 'flex' && t.date === d);
  const done = day.filter(t => t.done).length;
  return { done, total: day.length, full: day.length > 0 && done * 2 >= day.length };
}

// Code.gs tokens_() given a list of earned box days: Monday-to-Sunday weeks where every day that had
// homework earned a box. Returns all such weeks; the caller removes the ones already used.
export function realPickWeeks(tasks, earnedDays, start, today) {
  const have = new Set(earnedDays), out = [];
  for (let w = monday(start); w <= monday(today); w = addDays(w, 7)) {
    const sun = addDays(w, 6);
    if (today < sun) continue;
    let any = false, ok = true;
    for (let d = w; d <= sun; d = addDays(d, 1)) {
      if (d < start) continue;
      if (have.has(d)) { any = true; continue; }
      if (tasks.some(t => checkable(t) && t.date === d)) ok = false;
    }
    if (any && ok) out.push(w);
  }
  return out;
}

// Maps the old Sheet onto the new tables (docs/DB-PLAN.md, supabase/migrations). Pure: no network, no database.
// Every new ID is worked out from the student and the old ID, so a re-run updates the same rows.
import { newId, bool, isDate, isTimestamp, nyDate, parseDuration } from './util.mjs';
import { CATS, GIFT_BOXES, LADDER, checkable, oldBalance, oldCoinsFor } from './old-rules.mjs';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SOURCE_BY_ADDED = { template: 'template', emma: 'student', sofia: 'coach', setup: 'coach', chat: 'helper' };
const VALUE_SET_BY = { template: 'template', coach: 'coach', helper: 'helper', platform: 'platform', student: null };
const IMPORT_NOTE = 'Imported from the old site';
const noonNY = d => `${d}T12:00:00-05:00`;
const minIso = (a, b) => (Date.parse(a) <= Date.parse(b) ? a : b);
const plus24h = ts => new Date(Date.parse(ts) + 864e5).toISOString();
const listSetting = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

// Reads the Tasks tab the way Code.gs readTasks_() did (rows without an id or a date are ignored there too).
function oldTasks(rows, rep) {
  const seen = new Set(), out = [];
  for (const r of rows) {
    const id = r.id.trim(), date = r.date.trim();
    if (!id || !isDate(date)) {
      if (id || date || r.title) rep.unmapped.push(`Tasks row ${r._row}: no usable id or date ("${r.title}"), skipped (the old site ignored it too)`);
      continue;
    }
    if (seen.has(id)) { rep.unmapped.push(`Tasks row ${r._row}: id ${id} appears twice, the second copy is skipped`); continue; }
    seen.add(id);
    const cat = CATS.includes(r.cat.trim()) ? r.cat.trim() : 'school';
    if (cat !== r.cat.trim()) rep.notes.push(`Tasks row ${r._row}: type "${r.cat}" is not a known type, read as "school" (as the old site did)`);
    out.push({
      _row: r._row, id, date, title: r.title, note: r.note, dur: r.dur, cat,
      order: Number(r.order) || 0, done: bool(r.done), doneAt: r.doneAt.trim(), proofText: r.proofText,
      proofPhoto: r.proofPhoto.trim(), deleted: bool(r.deleted), addedBy: r.addedBy.trim(), updatedAt: r.updatedAt.trim(),
      color: r.color.trim().toLowerCase(), due: isDate(r.due.trim()) ? r.due.trim() : '', rawDue: r.due.trim(),
      pile: bool(r.pile), coins: Number(r.coins) || 0,
    });
  }
  return out;
}

export function mapSnapshot(snap, { studentId, importAt, photoHashes = {} }) {
  const rep = { unmapped: [], notes: [], decisions: [] };
  const today = nyDate(importAt);
  const tasks = oldTasks(snap.tabs.Tasks.rows, rep);
  const squishies = snap.tabs.Squishies.rows;
  const ledgerOld = snap.tabs.Ledger.rows;
  const drive = snap.drivePhotos ? new Map(snap.drivePhotos.map(f => [f.id, f])) : null;
  const out = { tasks: [], template_items: [], ledger: [], collection: [], day_results: [], proof_images: [], prize_orders: [], student_settings: [] };
  const usedDrive = new Set();
  const keptTime = [], studentOpen = [];

  // ---- tasks ----
  for (const t of tasks) {
    const id = newId(studentId, 'task', t.id);
    let title = t.title.trim();
    if (!title) { title = 'Untitled'; rep.notes.push(`Task ${t.id} (${t.date}) had no title, saved as "Untitled"`); }
    if (title.length > 200) { title = title.slice(0, 200); rep.notes.push(`Task ${t.id}: title cut to 200 characters`); }
    const dur = parseDuration(t.dur);
    let note = t.note || '';
    if (dur.keepText && !note.includes(dur.keepText)) {
      note = note ? `${note} (${dur.keepText})` : dur.keepText;
      keptTime.push(dur.keepText);
    }
    if (t.rawDue && !t.due) rep.notes.push(`Task ${t.id}: due date "${t.rawDue}" is not a date, left empty`);

    let colorStep = null;
    if (t.color) {
      colorStep = LADDER.indexOf(t.color);
      if (colorStep < 0) { colorStep = null; rep.unmapped.push(`Task ${t.id} (${t.date}): color "${t.color}" is not on Emma's ladder, left empty so the app picks by due date`); }
    }

    let source = SOURCE_BY_ADDED[t.addedBy];
    if (t.addedBy === 'emma' && t.cat === 'rsm') source = 'platform';   // RSM pulls posted to the old site as "emma"
    if (!source) { source = 'coach'; rep.unmapped.push(`Task ${t.id}: added by "${t.addedBy || '(blank)'}" is unknown, saved as added by the coach`); }

    const row = {
      id, date: t.date, title, note: note || null, minutes: dur.minutes, type: t.cat, color_step: colorStep,
      sort_order: Math.round(t.order), due_date: t.due || null, deleted: t.deleted,
      source, source_platform: 'legacy_sheet', external_id: t.id, value_set_by: VALUE_SET_BY[source],
      proof_note: t.proofText ? t.proofText : null, proof_photo_path: null,
      done: false, done_at: null, not_today: t.pile, coins: 0,
      reward_status: 'provisional', confirmed_at: null, final_at: null,
    };

    if (t.done) {
      let doneAt = t.doneAt;
      if (!isTimestamp(doneAt)) {
        doneAt = isTimestamp(t.updatedAt) ? t.updatedAt : noonNY(t.date);
        rep.notes.push(`Task ${t.id} (${t.date}) was done but had no finish time; used ${isTimestamp(t.updatedAt) ? 'its last-changed time' : 'noon that day'}`);
      }
      let coins = Math.max(0, Math.round(t.coins));
      if (coins > 7) { rep.unmapped.push(`Task ${t.id}: ${coins} coins is above the old maximum (6 plus the egg); kept as 7`); coins = 7; }
      Object.assign(row, {
        done: true, done_at: new Date(doneAt).toISOString(), coins: Math.min(6, coins), not_today: false,
        reward_status: 'confirmed', confirmed_at: new Date(doneAt).toISOString(),
        final_at: minIso(plus24h(doneAt), importAt),           // imported history is final: nothing waits for review
      });
      if (t.pile) rep.notes.push(`Task ${t.id}: was both done and in Not today; saved as done`);
      if (!t.deleted && coins > 0) {
        out.ledger.push({ id: newId(studentId, 'ledger-earn', t.id), kind: 'earn', amount: Math.min(6, coins), status: 'confirmed',
          task_id: id, note: `${IMPORT_NOTE}: finished task`, created_at: row.done_at, confirmed_at: row.done_at });
        if (coins > 6) out.ledger.push({ id: newId(studentId, 'ledger-egg', t.id), kind: 'egg', amount: coins - 6, status: 'confirmed',
          task_id: id, note: `${IMPORT_NOTE}: egg bonus`, created_at: row.done_at, confirmed_at: row.done_at });
      }
    } else {
      if (t.coins) rep.notes.push(`Task ${t.id}: not done but showed ${t.coins} coins in the Sheet; ignored (the old site only paid finished tasks)`);
      // Value of a task that is still open (coins are fixed when a task is created in the new app).
      if (!t.deleted && checkable(t)) {
        if (source === 'student') {
          row.coins = t.cat === 'flex' ? 1 : 3;                 // PRD 3a default; Emma never sets a value (PRD 6f)
          if (t.date >= today) studentOpen.push(`${t.date} ${title}`);
        } else {
          row.coins = oldCoinsFor(t, today);
        }
      }
    }

    if (t.proofPhoto) {
      const m = t.proofPhoto.match(/[-\w]{25,}/);
      const driveId = m ? m[0] : null;
      if (!driveId) rep.unmapped.push(`Task ${t.id}: photo link "${t.proofPhoto.slice(0, 40)}..." has no Drive file ID; photo not linked`);
      else if (drive && !drive.has(driveId)) rep.unmapped.push(`Task ${t.id}: photo ${driveId} is not in the "Emma homework proof" folder; photo not linked`);
      else {
        const path = `${studentId}/${id}/${driveId}.jpg`;
        row.proof_photo_path = path;
        usedDrive.add(driveId);
        const f = drive && drive.get(driveId);
        out.proof_images.push({ id: newId(studentId, 'photo', driveId), task_id: id, storage_path: path,
          sha256: photoHashes[driveId] || null, phash: null, origin: null, taken_at: null,
          created_at: f && isTimestamp(f.createdTime) ? f.createdTime : row.done_at || importAt });
      }
    }
    out.tasks.push(row);
  }
  if (drive) for (const f of drive.values()) if (!usedDrive.has(f.id)) rep.unmapped.push(`Drive photo "${f.title}" is not linked to any task; not moved (proof photos must belong to a task)`);
  if (keptTime.length) rep.decisions.push(`${keptTime.length} tasks had a time or words in "how long" (for example "${keptTime[0]}"). The new tasks table has no time-of-day field, so the text is kept at the end of the note in brackets, and minutes are worked out where possible.`);
  if (studentOpen.length) rep.decisions.push(`${studentOpen.length} open tasks from today on were added by Emma. They get the default value (3 coins, dinner 1) until an adult sets it, because Emma never sets a value (PRD 6f): ${studentOpen.join('; ')}`);

  // ---- ledger: old purchases ----
  for (const l of ledgerOld) {
    if (!l.id.trim()) { if (l.kind || l.amount) rep.unmapped.push(`Ledger row ${l._row}: no id, skipped`); continue; }
    const kind = l.kind.trim() === 'shop' ? 'purchase' : l.kind.trim() === 'ticket' ? 'ticket' : null;
    if (!kind) { rep.unmapped.push(`Ledger row ${l._row}: kind "${l.kind}" is unknown, skipped`); continue; }
    const at = isTimestamp(l.at) ? new Date(l.at).toISOString() : noonNY(l.date);
    out.ledger.push({ id: newId(studentId, 'ledger', l.id.trim()), kind, amount: Math.round(Number(l.amount) || 0), status: 'confirmed',
      task_id: null, note: `${IMPORT_NOTE}: ${kind === 'purchase' ? 'bought' : 'ticket'} ${l.name}`.slice(0, 300), created_at: at, confirmed_at: at });
  }
  const newBalance = out.ledger.reduce((n, l) => n + l.amount, 0);
  if (newBalance < 0) {
    out.ledger.push({ id: newId(studentId, 'ledger-forgiven', 'import'), kind: 'forgiven', amount: -newBalance, status: 'confirmed', task_id: null,
      note: `${IMPORT_NOTE}: balance below zero forgiven`, created_at: importAt, confirmed_at: importAt });
    rep.decisions.push(`The old balance was ${newBalance}; a "forgiven" entry brings it to 0 (never a negative balance, PRD 6f).`);
  }

  // ---- collection and real picks ----
  // Box history is NOT imported (Sofia, Nov 15): her box count, sparkle streak and real-pick weeks start
  // from scratch in the new app. The items she got from old boxes stay on her shelf.
  const seenItems = new Set(), boxDays = new Set();
  for (const q of squishies) {
    const src = q.source.trim(), date = q.date.trim();
    const isBox = src === 'box' || src === 'sparkle box';
    if (isBox && isDate(date)) boxDays.add(date);
    if (q.kind.trim() === 'none') continue;                       // a box opened when everything was collected
    const itemId = q.itemId.trim();
    if (!itemId) { rep.unmapped.push(`Shelf item "${q.name}" has no item id; skipped`); continue; }
    if (seenItems.has(itemId)) { rep.unmapped.push(`Shelf item ${itemId} appears twice; the second copy is skipped`); continue; }
    seenItems.add(itemId);
    const via = src === 'shop' ? 'shop' : isBox ? (GIFT_BOXES.includes(date) ? 'gift' : 'box') : null;
    if (!via) { rep.unmapped.push(`Shelf item ${itemId}: source "${src}" is unknown; skipped`); continue; }
    out.collection.push({ id: newId(studentId, 'collection', q.id.trim() || itemId), item_id: itemId, item_name: q.name, rarity: q.rarity || null,
      acquired_via: via, box_date: isBox && isDate(date) ? date : null, shelf_pos: Math.round(Number(q.pos) || 0),
      acquired_at: isTimestamp(q.openedAt) ? new Date(q.openedAt).toISOString() : noonNY(date) });
    if (q.realWeek.trim()) {
      // Sofia confirmed on Nov 15 that the real pick arrived.
      out.prize_orders.push({ id: newId(studentId, 'prize', q.realWeek.trim()), week_start: q.realWeek.trim(), item_name: q.name,
        price_cents: Math.round((Number(q.price) || 0) * 100), status: 'delivered' });
    }
  }
  if (out.prize_orders.length) rep.decisions.push(`${out.prize_orders.length} real weekly pick(s) recorded as delivered (confirmed by Sofia). Weeks: ${out.prize_orders.map(p => p.week_start).join(', ')}.`);
  rep.decisions.push(`Box history starts from scratch in the new app (Sofia, Nov 15): no box days are imported (${boxDays.size} opened in the old site, plus any waiting), so no waiting boxes, no sparkle streak and no real-pick weeks carry over. The ${out.collection.filter(c => c.acquired_via !== 'shop').length} items she got from old boxes stay on her shelf.`);

  // ---- weekly template ----
  const groups = new Map();
  for (const r of snap.tabs.Template.rows) {
    const wd = WEEKDAYS.indexOf(r.weekday.trim().slice(0, 3).toLowerCase());
    if (wd < 0 || !r.title.trim()) { if (r.title || r.weekday) rep.unmapped.push(`Template row ${r._row}: weekday "${r.weekday}" or title missing; skipped (the old site skipped it too)`); continue; }
    const cat = CATS.includes(r.cat.trim()) ? r.cat.trim() : 'school';
    const key = [r.title.trim(), r.note.trim(), r.dur.trim(), cat, Number(r.order) || 0, r.dueInDays.trim()].join('|');
    if (!groups.has(key)) groups.set(key, { r, cat, weekdays: [] });
    groups.get(key).weekdays.push(wd);
  }
  let blankDue = 0;
  for (const [key, g] of groups) {
    const dur = parseDuration(g.r.dur);
    let note = g.r.note.trim();
    if (dur.keepText && !note.includes(dur.keepText)) note = note ? `${note} (${dur.keepText})` : dur.keepText;
    const dueRaw = g.r.dueInDays.trim();
    let due = 0;
    if (dueRaw === '' || isNaN(Number(dueRaw))) blankDue++;
    else due = Math.max(0, Math.min(14, Math.round(Number(dueRaw))));
    out.template_items.push({ id: newId(studentId, 'template', key), weekdays: [...new Set(g.weekdays)].sort(), title: g.r.title.trim(),
      note: note || null, minutes: dur.minutes, type: g.cat, color_step: null, sort_order: Math.round(Number(g.r.order) || 0),
      due_in_days: due, active: true });
  }
  if (blankDue) rep.decisions.push(`${blankDue} template item(s) had no "due in days" (meaning no due date: dinner and classes). The new column cannot be empty, so it is 0. These are dinner and Plans, which have no proof or due date in practice.`);

  // ---- settings (only the two safe ones) ----
  out.student_settings.push({
    no_proof_types: snap.settings.noProofTypes != null ? listSetting(snap.settings.noProofTypes) : ['flex', 'fixed'],
    no_alert_types: snap.settings.noAlertTypes != null ? listSetting(snap.settings.noAlertTypes) : ['flex'],
  });

  if ((snap.tabs.Days?.rows || []).some(r => r.bring)) rep.unmapped.push('The Days tab has bring-home text; the importer does not map it yet (it was empty when this was written)');
  if ((snap.tabs.Status?.rows || []).some(r => r.taskId)) rep.notes.push('Someone was mid-Start in the old site; a running Start is not imported (it has no end)');
  rep.decisions.push('Not imported on purpose: this week\'s shop (step 7 makes its own), the Settings keys (sofiaKey, textTo: never read), and Apps Script properties (not in the Sheet).');

  // ---- the old site's own numbers, for the comparison ----
  const realWeeksUsed = new Set(squishies.map(q => q.realWeek.trim()).filter(Boolean));
  const old = {
    coins: oldBalance(tasks, ledgerOld),
    earnedCoins: tasks.filter(t => t.done && !t.deleted).reduce((n, t) => n + t.coins, 0),
    spentCoins: ledgerOld.reduce((n, l) => n + (Number(l.amount) || 0), 0),
    tasks: tasks.length, tasksNotDeleted: tasks.filter(t => !t.deleted).length,
    doneTasks: tasks.filter(t => t.done && !t.deleted).length,
    shelfItems: squishies.filter(q => q.kind.trim() !== 'none').length,
    boxesOpened: boxDays.size,
    shopPurchases: ledgerOld.filter(l => l.kind.trim() === 'shop').length,
    realPicksUsed: realWeeksUsed.size,
    photosLinked: tasks.filter(t => t.proofPhoto).length,
    templateRows: snap.tabs.Template.rows.filter(r => r.title.trim()).length,
  };
  return { out, rep, old, today };
}

#!/usr/bin/env node
// Moves Emma's history from the old Google Sheet into the new Supabase database (build step 10).
// The old Sheet and Drive are only ever read. See scripts/import/README.md for the plain-English guide.
//
//   node scripts/import/import.mjs plan    --snapshot DIR                 map only, no database
//   node scripts/import/import.mjs dry-run --snapshot DIR --target local  rolled-back test on a throwaway database
//   node scripts/import/import.mjs dry-run --snapshot DIR --target remote rolled-back test on the real project
//   node scripts/import/import.mjs real    ...                            NOT for step 10 (see README)
//
// Options: --waiting-boxes 2026-11-14,2026-11-15 | none   boxes Emma's old screen shows as waiting
//          --screen-coins N                               the coin counter on Emma's old screen
//          --photos-dir DIR                               downloaded Drive photos (<drive id>.jpg), for hashes
//          --out FILE                                     also save the report (keep it outside the repo)
import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readSnapshot } from './lib/snapshot.mjs';
import { mapSnapshot } from './lib/map.mjs';
import { dryRunSql, realSql } from './lib/sql.mjs';

const FAKE_STUDENT = '00000000-0000-4000-8000-00000000d0a1';   // only ever exists inside the rolled-back dry run

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'; o[k] = v; }
    else o._.push(a);
  }
  return o;
}

function photoHashes(dir) {
  const out = {};
  if (!dir) return out;
  for (const f of readdirSync(dir)) {
    const id = f.replace(/\.[^.]+$/, '');
    out[id] = createHash('sha256').update(readFileSync(join(dir, f))).digest('hex');
  }
  return out;
}

async function runRemote(sql) {
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!ref) throw new Error('set SUPABASE_PROJECT_REF (Project Settings > General > Reference ID)');
  // curl, like supabase/tests/run-remote.sh, because it follows the environment's proxy settings.
  // The token (if any) is passed through the environment, never on the command line or in output.
  const f = join(mkdtempSync(join(tmpdir(), 'emma-import-')), 'body.json');
  writeFileSync(f, JSON.stringify({ query: sql }), { mode: 0o600 });
  const auth = process.env.SUPABASE_ACCESS_TOKEN ? '-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"' : '';
  const p = spawnSync('bash', ['-c', `curl -sS -m 300 -X POST "https://api.supabase.com/v1/projects/${ref}/database/query" -H "Content-Type: application/json" ${auth} --data @"${f}"`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env });
  return (p.stdout || '') + (p.stderr || '');
}

function runLocal(sql) {
  const psql = process.env.IMPORT_PSQL;
  if (!psql) throw new Error('use scripts/import/dry-run-local.sh (it builds the throwaway database and sets IMPORT_PSQL)');
  const f = join(mkdtempSync(join(tmpdir(), 'emma-import-')), 'dry.sql');
  writeFileSync(f, sql, { mode: 0o600 });
  const p = spawnSync('bash', ['-c', `${psql} -f "${f}"`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return (p.stdout || '') + (p.stderr || '');
}

function extractDryRun(text) {
  const i = text.indexOf('EMMA_IMPORT_DRYRUN ');
  if (i < 0) throw new Error('the dry run did not finish. Database said:\n' + text.slice(0, 2000));
  let s = text.slice(i + 'EMMA_IMPORT_DRYRUN '.length);
  // Remote errors come back JSON-escaped inside {"message": ...}; local ones are plain.
  try { const j = JSON.parse(text); if (j.message) s = j.message.slice(j.message.indexOf('EMMA_IMPORT_DRYRUN ') + 19); } catch {}
  let depth = 0, end = -1;
  for (let k = 0; k < s.length; k++) { if (s[k] === '{') depth++; else if (s[k] === '}') { depth--; if (depth === 0) { end = k + 1; break; } } }
  return JSON.parse(s.slice(0, end));
}

function report({ mode, target, old, rep, db, screenCoins, waitingBoxes, out }) {
  const L = [], checks = [];
  const ok = (name, pass, detail = '') => checks.push(`${pass ? 'pass' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  L.push(`Emma's Homework: old Sheet import, ${mode}${target ? ` (${target})` : ''}`, `Run at ${new Date().toISOString()}`, '');
  L.push('What will be written (rows)');
  for (const [k, v] of Object.entries(out)) L.push(`  ${k.padEnd(18)} ${v.length}`);
  L.push('');
  if (db) {
    const n = db.numbers;
    L.push('Old site vs new database', '  what                      old site   new database');
    const row = (label, a, b) => L.push(`  ${label.padEnd(26)}${String(a ?? 'unknown').padStart(8)}   ${String(b).padStart(8)}`);
    row('coins (spendable)', old.coins, n.coins_spendable);
    row('coins earned from tasks', old.earnedCoins, n.coins_earned);
    row('coins spent in the shop', old.spentCoins, n.coins_spent);
    row('tasks (all, incl. deleted)', old.tasks, n.tasks);
    row('tasks not deleted', old.tasksNotDeleted, n.tasks_not_deleted);
    row('finished tasks', old.doneTasks, n.done_tasks);
    row('shelf items', old.shelfItems, n.shelf_items);
    row('boxes opened', old.boxesOpened, n.boxes_opened);
    row('sparkle boxes', old.sparkleBoxes, n.sparkle_boxes);
    row('boxes waiting', old.boxesWaiting, n.boxes_waiting);
    row('real weekly picks used', old.realPicksUsed, n.real_picks_recorded);
    row('proof photos', old.photosLinked, n.photos);
    row('template day slots', old.templateRows, n.template_day_slots);
    if (screenCoins != null) row('coins on Emma\'s screen', screenCoins, n.coins_spendable);
    L.push(`  (template: ${n.template_items} items cover those ${n.template_day_slots} weekday rows; full boxes ${n.full_boxes}, mini boxes ${n.mini_boxes})`, '');

    ok('coins match the old site', n.coins_spendable === Math.max(0, old.coins), `${old.coins} vs ${n.coins_spendable}`);
    if (screenCoins != null) ok('coins match Emma\'s old screen', n.coins_spendable === screenCoins);
    ok('no held coins (imported history is confirmed)', n.coins_held === 0 && n.ledger_rows_not_confirmed === 0);
    ok('no finished task is still provisional or reviewable', n.done_not_confirmed === 0 && n.review_window_open === 0);
    ok('every paid finished task has its ledger entry', n.done_coins_without_ledger === 0);
    ok('boxes gave no coins (mini box included)', n.ledger_box_rows === 0);
    ok('finished tasks match', n.done_tasks === old.doneTasks);
    ok('all task rows came across', n.tasks === old.tasks);
    ok('shelf matches', n.shelf_items === old.shelfItems);
    ok('every shelf item is in the item list', n.shelf_items_not_in_catalog === 0);
    ok('opened boxes match', n.boxes_opened === old.boxesOpened);
    ok('sparkle boxes match', n.sparkle_boxes === old.sparkleBoxes);
    ok('real picks match', n.real_picks_recorded === old.realPicksUsed);
    ok('every linked photo has a photo record', n.photos === old.photosLinked && n.tasks_with_photo === old.photosLinked);
    ok('every photo path is inside the student\'s own folder', n.photo_paths_outside_her_folder === 0);
    ok('template covers every old template row', n.template_day_slots === old.templateRows);
    if (db.rerun_changed_numbers !== undefined) {
      const removedOnRerun = Object.values(db.second_run.removed).reduce((n, v) => n + v, 0);
      ok('a second run finds the same rows and updates them (same IDs, nothing removed or added)', db.rerun_changed_numbers === false
        && removedOnRerun === 0 && JSON.stringify(db.first_run.written) === JSON.stringify(db.second_run.written), `${removedOnRerun} rows replaced`);
      const expected = ['tasks', 'ledger', 'collection', 'day_results', 'template_items', 'proof_images'].reduce((n, k) => n + out[k].length, 0);
      ok('after the re-run every row exists exactly once', db.rows_after_rerun === expected + 1, `${db.rows_after_rerun - 1} rows, expected ${expected}`);
      ok('a re-run after the new app is used stops and changes nothing', String(db.rerun_guard).includes('IMPORT_STOP'));
      ok('a student cannot write coins into the ledger herself', String(db.student_writes_ledger).startsWith('refused'), db.student_writes_ledger);
      ok('each run left one summary line in the audit log', db.audit_rows === 2, `${db.audit_rows} lines`);
    }
    L.push('Checks', ...checks.map(c => '  ' + c), '');
  }
  L.push(`Boxes waiting on the old screen: ${waitingBoxes ? (waitingBoxes.length ? waitingBoxes.join(', ') : 'none') : 'NOT GIVEN. The Sheet does not store them; read them from Emma\'s old screen before the real run.'}`);
  L.push(`  Days that look like earned-but-unopened boxes (estimate only, not imported): ${rep.estimates.waitingBoxCandidates.join(', ') || 'none'}`);
  L.push(`  Weeks that might still owe a real pick (estimate only): ${old.realPickWeeksEstimate.join(', ') || 'none'}`, '');
  L.push(`Could not map (${rep.unmapped.length})`, ...(rep.unmapped.length ? rep.unmapped.map(s => '  - ' + s) : ['  nothing']), '');
  L.push(`Mapping decisions (${rep.decisions.length})`, ...rep.decisions.map(s => '  - ' + s), '');
  L.push(`Small fixes (${rep.notes.length})`, ...(rep.notes.length ? rep.notes.map(s => '  - ' + s) : ['  none']));
  const failed = checks.filter(c => c.startsWith('FAIL')).length;
  L.push('', db ? `EMMA_IMPORT result=${failed ? 'FAIL' : 'PASS'} checks=${checks.length} failed=${failed}` : 'EMMA_IMPORT result=PLAN (no database used)');
  return { text: L.join('\n'), failed };
}

async function main() {
  const a = args(process.argv.slice(2));
  const mode = a._[0];
  if (!['plan', 'dry-run', 'real'].includes(mode)) { console.error('usage: import.mjs plan|dry-run|real --snapshot DIR [...]'); process.exit(2); }
  if (!a.snapshot) { console.error('--snapshot DIR is required'); process.exit(2); }
  const waitingBoxes = a['waiting-boxes'] == null ? null : a['waiting-boxes'] === 'none' ? [] : a['waiting-boxes'].split(',').map(s => s.trim()).filter(Boolean);
  const screenCoins = a['screen-coins'] == null ? null : Number(a['screen-coins']);
  const importAt = new Date().toISOString();

  if (mode === 'real') {
    // Guarded on purpose. Step 10 prepares the import; the real run needs Emma's account and Sofia's go-ahead.
    const sid = a.student;
    if (!/^[0-9a-f-]{36}$/.test(sid || '')) { console.error('real: --student <Emma\'s account id> is required'); process.exit(2); }
    if (a.confirm !== `import into ${sid}`) { console.error(`real: add --confirm "import into ${sid}" (only with Sofia's explicit go-ahead)`); process.exit(2); }
    if (!waitingBoxes) { console.error('real: --waiting-boxes is required (dates from Emma\'s old screen, or "none")'); process.exit(2); }
    if (screenCoins == null) { console.error('real: --screen-coins is required (the number on Emma\'s old coin counter)'); process.exit(2); }
    const snap = readSnapshot(a.snapshot);
    const { out } = mapSnapshot(snap, { studentId: sid, importAt, waitingBoxes, photoHashes: photoHashes(a['photos-dir']) });
    const text = await runRemote(realSql(sid, out));
    console.log(text);
    return;
  }

  const sid = FAKE_STUDENT;
  const snap = readSnapshot(a.snapshot);
  const { out, rep, old } = mapSnapshot(snap, { studentId: sid, importAt, waitingBoxes, photoHashes: photoHashes(a['photos-dir']) });
  let db = null;
  if (mode === 'dry-run') {
    const target = a.target || 'local';
    // Map a second time from scratch with a later clock, as a real re-run would.
    const again = mapSnapshot(snap, { studentId: sid, importAt: new Date(Date.now() + 1000).toISOString(), waitingBoxes, photoHashes: photoHashes(a['photos-dir']) }).out;
    const sql = dryRunSql(sid, out, again);
    const raw = target === 'remote' ? await runRemote(sql) : runLocal(sql);
    db = extractDryRun(raw);
  }
  const r = report({ mode, target: mode === 'dry-run' ? a.target || 'local' : null, old, rep, db, screenCoins, waitingBoxes, out });
  console.log(r.text);
  if (a.out) writeFileSync(a.out, r.text + '\n', { mode: 0o600 });
  process.exit(r.failed ? 1 : 0);
}

main().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });

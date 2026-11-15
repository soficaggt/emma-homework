#!/usr/bin/env node
// Moving the proof photos from the Drive folder "Emma homework proof" into the private proof-photos
// bucket, under the student's own folder: <student id>/<task id>/<drive file id>.jpg
// Drive is only read. See PHOTOS-PLAN.md for the order of steps.
//
//   node photos.mjs manifest --snapshot DIR --student UUID [--out FILE]   which photo goes where (no network)
//   node photos.mjs check    --snapshot DIR --photos-dir DIR              are all downloaded files here and whole?
//   node photos.mjs upload   --snapshot DIR --photos-dir DIR --student UUID --confirm "upload photos for UUID"
//        (real run only; needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment settings)
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readSnapshot } from './lib/snapshot.mjs';
import { mapSnapshot } from './lib/map.mjs';

const a = { _: [] };
for (let i = 2; i < process.argv.length; i++) {
  const x = process.argv[i];
  if (x.startsWith('--')) a[x.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true';
  else a._.push(x);
}
const die = m => { console.error(m); process.exit(2); };
const cmd = a._[0];
if (!a.snapshot) die('--snapshot DIR is required');
const snap = readSnapshot(a.snapshot);
const drive = new Map((snap.drivePhotos || []).map(f => [f.id, f]));
const sid = a.student || '00000000-0000-4000-8000-00000000d0a1';
const { out } = mapSnapshot(snap, { studentId: sid, importAt: new Date().toISOString() });
const plan = out.proof_images.map(p => {
  const driveId = p.storage_path.split('/').pop().replace(/\.jpg$/, '');
  const t = out.tasks.find(x => x.id === p.task_id);
  return { driveId, driveTitle: drive.get(driveId)?.title || '?', size: drive.get(driveId)?.size || null, taskDate: t.date, path: p.storage_path };
});
const localFile = (dir, id) => readdirSync(dir).find(f => f.replace(/\.[^.]+$/, '') === id);

if (cmd === 'manifest') {
  for (const p of plan) console.log(`${p.taskDate}  ${p.driveTitle.padEnd(36)}  ->  proof-photos/${p.path}`);
  console.log(`${plan.length} photos. Student folder: ${sid}${a.student ? '' : ' (fake dry-run student; pass --student for the real one)'}`);
  if (a.out) writeFileSync(a.out, JSON.stringify(plan, null, 2), { mode: 0o600 });
} else if (cmd === 'check') {
  if (!a['photos-dir']) die('--photos-dir DIR is required');
  let bad = 0;
  for (const p of plan) {
    const f = localFile(a['photos-dir'], p.driveId);
    if (!f) { console.log(`MISSING  ${p.driveTitle}`); bad++; continue; }
    const buf = readFileSync(join(a['photos-dir'], f));
    const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const sizeOk = p.size == null || buf.length === Number(p.size);
    if (!jpeg || !sizeOk) bad++;
    console.log(`${jpeg && sizeOk ? 'ok      ' : 'BAD     '} ${p.driveTitle}  ${buf.length} bytes${sizeOk ? '' : ` (Drive says ${p.size})`}${jpeg ? '' : ' (not a JPEG)'}  sha256 ${createHash('sha256').update(buf).digest('hex').slice(0, 16)}...`);
  }
  console.log(bad ? `PHOTOS result=FAIL problems=${bad}` : `PHOTOS result=PASS photos=${plan.length}`);
  process.exit(bad ? 1 : 0);
} else if (cmd === 'upload') {
  // Not run in step 10. Written for the real run; untested until a service key is available.
  if (!a.student) die('--student is required');
  if (a.confirm !== `upload photos for ${a.student}`) die(`add --confirm "upload photos for ${a.student}" (only with Sofia's explicit go-ahead)`);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) die('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment settings (never in a file or the chat)');
  let failed = 0;
  for (const p of plan) {
    const f = localFile(a['photos-dir'], p.driveId);
    if (!f) { console.log(`MISSING ${p.driveTitle}`); failed++; continue; }
    const hdr = join(mkdtempSync(join(tmpdir(), 'emma-photo-')), 'h');
    // The key goes in a header file readable only by us, so it never appears in a command line or output.
    writeFileSync(hdr, `Authorization: Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}\n`, { mode: 0o600 });
    const url = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/proof-photos/${p.path}`;
    const r = spawnSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'POST', url, '-H', `@${hdr}`,
      '-H', 'Content-Type: image/jpeg', '-H', 'x-upsert: false', '--data-binary', `@${join(a['photos-dir'], f)}`], { encoding: 'utf8' });
    writeFileSync(hdr, '');
    const code = (r.stdout || '').trim();
    const ok = code === '200' || code === '409' || code === '400';   // 409/400 "already exists": a re-run is safe, nothing is replaced
    if (!ok) failed++;
    console.log(`${ok ? 'ok ' : 'ERR'} ${code} ${p.driveTitle}`);
  }
  console.log(failed ? `UPLOAD result=FAIL failed=${failed}` : `UPLOAD result=PASS photos=${plan.length}`);
  process.exit(failed ? 1 : 0);
} else die('usage: photos.mjs manifest|check|upload --snapshot DIR [...]');

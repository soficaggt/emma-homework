# Moving Emma's history from the old Sheet (build step 10)

This folder copies Emma's history from the old Google Sheet and the Drive photo folder into the new
Supabase database. The old Sheet and Drive are only ever **read**. Nothing here writes to them.

Status: prepared and tested with a dry run. **Not run for real.** The real run needs Emma's account
(step 3) and Sofia's explicit go-ahead.

ADHD check (PRD 1a): it passes because Emma loses nothing and re-earns nothing: her coins, shelf,
boxes and finished work arrive exactly as she left them, already confirmed, with no new pressure or
penalty (principles 4 and 7).

## What is in here

| File | What it does |
|---|---|
| `import.mjs` | Reads a snapshot of the Sheet, maps it onto the new tables, and runs a `plan`, a `dry-run`, or (later) the `real` import |
| `dry-run-local.sh` | Builds a throwaway local database from `supabase/migrations/`, runs the dry run, then deletes the database |
| `photos.mjs` | Lists which photo goes where, checks downloaded photos are whole, and (later) uploads them |
| `PHOTOS-PLAN.md` | The plan for moving the photos into the private `proof-photos` bucket |
| `lib/` | The mapping (`map.mjs`), the old site's arithmetic (`old-rules.mjs`), the SQL (`sql.mjs`) |

## The snapshot (Emma's data never goes into git)

The script reads a folder with one file per Sheet tab, exactly as the Google Sheets API returns it:
`Tasks.json`, `Template.json`, `Squishies.json`, `Ledger.json`, `Days.json`, `Status.json`, plus
`Settings-safe.json` (only `noProofTypes` and `noAlertTypes`) and `drive-photos.json` (the Drive folder
listing). In step 10 Claude took it read-only through the Google connectors and kept it in the
session's private scratch folder. `.gitignore` here blocks `snapshot/` and `photos/` in case one is ever
put in this folder. The Settings values `sofiaKey` and `textTo` are never read.

## Where each old thing goes

| Old (Sheet) | New table | How |
|---|---|---|
| Tasks tab | `tasks` | One row per old task, new ID worked out from the old ID (so a re-run updates). `source_platform = 'legacy_sheet'`, `external_id` = the old ID. Old `addedBy`: template to `template`, emma to `student` (RSM pulls to `platform`), sofia and setup to `coach`, chat to `helper` |
| Old color | `tasks.color_step` | Emma's ladder order: purple 0, blue 1, white 2, pink 3, orange 4, yellow 5, green 6, gray 7. Empty stays empty (the app picks by due date) |
| "How long" text | `tasks.minutes` | Lengths become minutes. Class times like "5:50 to 7:20" become minutes **and** stay in the note in brackets, because there is no time-of-day field yet |
| Finished tasks | `tasks` + `ledger` | Done, already **confirmed** and **final** (no review window, no held coins). Each paid task gets one confirmed `earn` entry |
| Ledger tab (shop) | `ledger` | Confirmed `purchase` entries (negative) |
| Squishies tab | `collection` | Shop items `shop`, box items `box`, the Oct 28 box Sofia gave back `gift`. Shelf order kept |
| Box days | (none) | **Not imported** (Sofia, Nov 15): her box count starts from scratch in the new app, so no waiting boxes, sparkle streak or real-pick weeks carry over. The items from old boxes stay on her shelf. No coins for any box, mini box included (PRD 3a) |
| Real weekly pick | `prize_orders` | Recorded as `delivered` for its week (Sofia confirmed it arrived) |
| Template tab | `template_items` | Identical rows on different weekdays become one item with several weekdays (18 rows to 8 items) |
| Settings (2 safe ones) | `student_settings` | `no_proof_types`, `no_alert_types` |
| Proof photos | `proof_images` + bucket | See PHOTOS-PLAN.md |

Values of tasks that are still open: template, coach and RSM tasks get what the old site would have paid
(dinner 1, else by color). Tasks Emma added herself get the default 3 (dinner 1), because Emma never sets
a value (PRD 6f).

Not imported, on purpose: box history (see above), this week's shop (step 7 makes its own), a running
Start (none today), the Settings secrets, and the Apps Script properties (earned-day list, full-day list,
moved lists), which are not in the Sheet and only fed the box history.

## How a re-run stays safe

- Every new ID is worked out from the old ID, so running it twice updates the same rows.
- Each run writes one summary line in `audit_log` listing the rows it made. The next run uses that to
  remove rows that are no longer in the Sheet.
- **Safety stop:** if anything exists for her that an earlier import did not make (the new app has been
  used), the run stops and changes nothing.

## Running the dry run

The dry run makes a fake student, imports into it **twice** (the second time from a fresh mapping),
checks a fake app task trips the safety stop, checks the fake student cannot write coins herself, prints
the report, and then throws everything away (the whole thing is one block that always rolls back).

```bash
scripts/import/dry-run-local.sh --snapshot /path/to/snapshot
```

```bash
SUPABASE_PROJECT_REF=<project ref> node scripts/import/import.mjs dry-run --target remote --snapshot /path/to/snapshot
```

The remote one needs the Supabase connection this environment already has (or `SUPABASE_ACCESS_TOKEN`
in the environment settings). Look for `EMMA_IMPORT result=PASS` at the end.

Optional: `--screen-coins N`, the number on Emma's old coin counter, as an extra check.

## The real run (not in step 10)

Only with Sofia's explicit go-ahead, after step 3 has made Emma's account, ideally at switch-over
(step 15) so the old site stops changing. In order:

1. Take a fresh snapshot (read-only).
2. Optional: Sofia reads the coin counter on Emma's old screen.
3. Download the photos and check them (PHOTOS-PLAN.md).
4. Dry run on the real project: must say PASS.
5. Upload the photos (`photos.mjs upload`).
6. `node scripts/import/import.mjs real --snapshot DIR --photos-dir DIR --student <Emma's id> --confirm "import into <Emma's id>"` (add `--screen-coins N` if read in step 2)
7. Check Emma's new screen shows the same coins and shelf.
8. Delete the local snapshot and photo copies.

The `real` command refuses to start without `--student` and the matching `--confirm`.

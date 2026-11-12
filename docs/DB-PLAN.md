# Database and permissions plan (for approval)

Nothing here is built yet. This is the plan in plain English. Session 2 builds it after you approve.

## The three roles

- **Coach (Sofia):** sees and edits everything for every student she coaches. Creates accounts.
- **Student (Emma):** sees and edits only her own tasks, proof, and collection. Cannot touch other students.
- **Parent (Annat):** read-only, only their own child's proof and progress.

Every login is a Supabase Auth account. Each account has one row saying its role and first name.

## The tables (what gets stored)

**People**
- `profiles`: one per login. Role (coach, student, parent), first name, username, time zone.
- `student_links`: which coach coaches which student, and which parent(s) belong to which student. This one table drives most permission rules.

**Homework**
- `tasks`: the checklist. Student, date, title, note, how long, type (test, school, hunter, rsm, fixed, flex), color, order, done, when done, proof note, proof photo path, due date, in the Not today pile, coins, deleted. New fields for integrations: `source` (manual, template, rsm, schoology, pearson, hunter and so on), `external_id` (the platform's own ID, so a re-pull updates instead of duplicating), `proof_rule`, `verified_by`, `verified_at`, `verified_evidence`.
- `template_items`: the weekly recurring tasks per student.
- `work_sessions`: the Start button. Student, task, started, ended. Sofia watches this live.
- `bring_home`: the what-to-bring-home list per student per night.
- `student_settings`: types that need no proof, types that send no alert, bring-home rules, time zone.

**Rewards**
- `reward_catalog`: the real squishies and slime items (the 50-item list in Code.gs), with rarity and price. Only Sofia can edit.
- `collection`: what each student owns, and in what order on her shelf.
- `ledger`: coin purchases and tickets (negative amounts for spending).
- `day_results`: one row per student per day: box earned, full or mini, sparkle, opened, plus which tasks were moved off the day. This replaces the old script properties (`earned`, `fullDays`, `moved-DATE`).
- `shop_weeks`: this week's 12 shop items per student, so the shop stays the same all week.

**Alerts**
- `notifications`: every alert is a row (who gets it, student, kind, text, task, photo path, read or unread). This is the bell inbox.
- `notification_prefs`: which kinds each person wants, per channel. Channels start as "in app" and "push". Text and email can be added later with no change to anything else.
- `push_tokens`: each phone's Apple push address.

**Safety and automation**
- `automation_keys`: one per pull task, tied to one student. Only a hash of the key is stored. Sofia can revoke it.
- `chat_usage`: the 80-a-day counter per user.
- `audit_log`: who changed what, and who opened which photo, and when.

**Photos**
- One private storage bucket, `proof-photos`. Path starts with the student's ID. Photos open only through links that expire in minutes.

## The rules (Row Level Security), in plain English

Every table has security turned on with nothing allowed by default. Then:

1. A student can read and add rows for herself only. She can edit her own task titles, notes, dates, colors, order, and the Not today pile. She cannot write her own coins, her verified status, her box results, or anything in another student's data.
2. A parent can read, never write, the rows for their own child's tasks, proof and progress. A parent cannot see the Helper chat, the catalog editor, or other students.
3. The coach can read and write everything for the students she coaches.
4. Anything that must not be forgeable goes through a server-side function instead of a direct table write:
   - Completing a task (sets done, time, coins, egg bonus, alert, and checks proof is present).
   - Opening a mystery box (does the dice roll on the server using the rules in PRD 3a).
   - Buying from the shop and the real weekly pick.
   - Verified-by-platform (only an automation key can set it).
   - Chat messages (the Anthropic key lives only there).
5. Photos: a student can upload into her own folder only. Nobody can list the bucket. Sofia and the student's parent can get a short-lived link to that student's photos, and each open is written to the audit log.
6. Automation keys can add or update tasks and mark them verified for their one student. They cannot read anything else.

## What I would not carry over from the old code

- The shared Sofia key and the Google link as passwords.
- Red and black in the color list and in the Helper's instructions.
- The ntfy channel name (exposed in the public repo) and alerts sent from the browser.
- The hard-coded "Get ready for her call at 10pm" message in the "Nice, that is done" toast (needs to be a setting, or removed).
- Edits made directly in a spreadsheet clashing with the app (the database fixes this).

## Things in the old code that need your decision

1. The Nov 1 commit message says a mini box gives 2 coins, but the code gives no coins from boxes. Which is right?
2. The old chat gives 3 coins for anything checked off through it. Keep that, or use the normal color-based coins?
3. Gift boxes (the one you gave back on Oct 28) are hard-coded. I would make "give a box" a button on the Yoda screen.

## How I will check it (session 2 "done when")

I will create two fake students, one fake parent and one fake coach, and run automated tests that try to break the rules: student A reading student B's tasks, a student setting her own coins, a parent writing anything, a student opening another student's photo, a stolen automation key reading other students. All must be refused.

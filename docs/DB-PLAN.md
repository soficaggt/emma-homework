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

**Themes and personalization (revised Nov 12)**
- `themes`: per student (or a template Sofia reuses): name, page names and icons, palette, fonts, shapes, mascot and what hatches, celebration style, wording and tone, currency name and look, theming depth (rewards only up to whole app), and a `color_system`: an ordered list of steps, each with color, name and meaning, plus the mode (urgency ladder, by subject, by type, or none). Emma's current look is the first row.
- `reward_packs`: per student: what is collected and its name, digital collectibles on or off, real prizes on or off and budget, rarity names, art style, item sources, and the currency skin (default gold coins). The economy numbers (earn rates, prices by rarity, box odds, shop size, refresh day, box rules) are not stored per student: they are one shared set that only the developers change.
- `catalog_items`: per pack: name, image or art reference, price, link, tags, rarity, source (hand-made, pasted wishlist, web search, connected account), and status (proposed, approved). Only Sofia approves. Links out are flagged for the parent gate.
- `student_setup`: the saved interview answers, so the Helper can rebuild or extend a theme and pack when interests change.
- `helper_characters`: per theme: for each of the three jobs (planner, tutor, checker), the character's name and art reference. The jobs are fixed; the names and looks are theme data.
- `tasks.color_step`: the task's chosen step in the student's color system (replaces a fixed color name).

**ADHD profile (added Nov 12)**
- `adhd_profiles`: one per student: the "How I work" answers (starting, staying, time sense, remembering, planning, switching, feelings, motivation, best and worst times of day, environment, what worked), who filled it in (parent, coach, student, clinician form upload), when, each upload as a new version the parent approved, consent flags (stored, Helper may receive derived settings), and a version. No diagnosis or medication fields. Readable and editable only by the coach, the student (her kid-friendly view) and her parent. Reads are written to the audit log.
- `profile_settings`: the derived settings the app and Helper actually use: first-step size, timer style, break lengths, plan slack, items shown, reminder style and timing, tone and avoided words, best-focus windows. This is the only part the Helper receives.
- `profile_suggestions`: changes the Helper proposes from the data, with status (proposed, approved, rejected). Only Sofia approves.
- `tasks` gains `first_step` (a tiny starting step), `estimated_minutes` and `actual_minutes` (for Time Detective and learning).
- `skill_events`: starting, writing it down, packing and planning actions (student, kind, time), used for rewards for skill use. The amounts are one shared fixed set, decided in step 7.

**Projects (added Nov 12)**
- `projects`: student, title, source (platform, email, Sofia, Emma), due date, size, status, the assignment sheet or rubric (text and image path), and who created it.
- `tasks` gains `project_id` and `project_step` (the order of the step in its project).
- `planning_conversations`: project, each question, each answer, who answered (Emma or Sofia), and when. Emma approves or edits a project plan before it lands in her week. Her edits are logged, Sofia can see and edit the plan, and Emma cannot change the due date the source set.

**Tutor (added Nov 12)**
- `tutor_settings`: per student: curated videos on or off, and consent recorded (who agreed and when). There is no answer-mode setting: the tutor never gives final answers.
- `tutor_conversations`: readable by the coach and the student's parent only.
- `tutor_flags`: repeated attempts to get the final answer, shown to the coach as a pattern and never to the student as an accusation.

**Keeping her in her plan (added Nov 12)**
- `plan_changes` (see Helper v2) also records when each change was shown to the student and when she acknowledged or undid it. A change made by the planner or by an adult is always shown to her.
- `tasks` gains `start_plan`: her own if-then start plan in her words ("After dinner, I will start Latin at the kitchen table").
- `walkthroughs`: student, date, and only whether she did it or skipped it. No recall score is stored or shown.

**Integrity (added Nov 12)**
- `tasks` gains `reward_status` (provisional, confirmed, reversed), `review_status` (unreviewed, looks_good, needs_more, not_done), `reviewed_by`, `reviewed_at`, `review_note`, `proof_questions` (the questions generated for the task), `proof_answers`, `value_set_by` (template, coach, Helper, platform, AI intake, adult), `confirmed_at`, and `final_at` (24 hours after she finishes). `source` (template, coach, Helper, platform, or student) already exists and drives which tasks are trusted.
- `proof_checks`: task, kind (rules or AI), result (pass, needs more, unclear), the reason in plain words, and when.
- `task_intake`: for each task Emma adds: the name she typed, what it was matched to, the questions and answers, the AI's verdict, the priority step and size it set, any claims she made that would raise the value (like a test date) marked unverified until a platform, the calendar or an adult confirms them, and whether it is waiting for an adult. How long her answers are kept is still to be confirmed.
- `proof_images`: task, storage path, content hash and perceptual hash (to catch reuse), where it came from (in-app camera, library, screenshot), and taken-at.
- `integrity_flags`: student, task, kind (implausible title, too fast, duplicate, reused text or photo, many self-added), status, and who has seen it.
- `ledger` gains a status (held, confirmed, reversed, forgiven) and reversal entries that point at the task they undo, so the balance stays auditable. Only confirmed coins can be spent.
- `student_settings` gains `proof_strictness` (gentle, normal, strict; default normal). The review window is fixed at 24 hours for everyone and is not a setting.
- Rules: a student can never write the review fields, `reward_status`, or the ledger. Held versus confirmed coins, the 24-hour window, auto-confirm, and a box waiting for its tasks to be confirmed are all enforced on the server. Deleting a finished task keeps its audit trail and its flags.

**Helper v2 (added Nov 12)**
- `plan_changes`: every reschedule: student, what changed, who or what did it (Emma, Sofia, Helper), why, status (suggested, applied, undone), and the before-and-after so it can be undone with one tap.
- `helper_settings`: per student autonomy level (suggest only, small moves, everything), daily call budget, and whether chat with the student is on.

**Connections (added Nov 12)**
- `connections`: student, platform, tier (feed, email, browser, manual), status (working, needs reconnect, paused), parent consent recorded, last run, last error.
- `inbound_addresses`: each student's private email address for forwarded homework.
- Browser sessions for the always-on agent are kept in an encrypted vault outside these tables (Supabase Vault or the agent host's own secret store), never in a readable column.

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

# Progress

Read this at the start of every session and update it at the end. Rules are in CLAUDE.md, requirements in docs/PRD.md.

## Status

| # | Step | Done when | Status |
|---|---|---|---|
| 0 | Accounts and keys (user does this) | Keys saved in the environment settings, open questions answered | In progress |
| 1 | Foundation: PRD, CLAUDE.md, this file, database plan | User approves docs/DB-PLAN.md | Done. Database plan approved Nov 12 |
| 2 | Database and security (including themes, connections, plan history) | Two fake students cannot see each other's data; a fake parent sees only their child; a student cannot forge coins or verified status | Not started |
| 3 | Logins and the Yoda screen | An adult can invite Emma, she chooses her own username and password and signs in, and a reset sends her a one-time link (adults never see her password) | Not started |
| 4 | Days checklist in Expo, on theme settings | Looks and behaves like today's site, colors from theme data, today view by default with one clear next task and a first-step prompt | Not started |
| 5 | Start, egg, proof and photos, with the AI assignment intake and layered proof checks (6f) | A photo uploads, only Sofia can open it, a made-up assignment earns nothing, and junk proof (filler text, reused text or photos) is caught or flagged | Not started |
| 6 | Calendar, Plans, bring-home list | Due dates stay off the daily list | Not started |
| 7 | Rewards engine: one fixed economy, provisional rewards an adult can reverse (6f), reward packs and currency skins | A cleared day gives a box, rules match PRD 3a exactly, and two students with different themes earn and pay the same amounts, and reversing a task removes its coins | Not started |
| 8 | The helpers: planner (chat, rescheduling, project planning) and tutor, with separate permissions, plus keeping Emma in her plan (6i) | Finishing late triggers a sensible replan, undoable, and a posted project becomes a week of small steps that Emma approves or edits, and every change to her plan is shown to her | Not started |
| 9 | Personalization: setup interview including the ADHD profile, themes, color systems, reward packs, item sources | A second fake student (for example into Star Wars) gets a different look, color meanings and reward pack from the interview | Not started |
| 10 | Move data from the Sheet and Drive | Emma's real history matches the old site | Not started |
| 11 | Notifications: bell inbox, then push | Finishing a task puts an alert in Sofia's bell | Not started |
| 12 | Proof board for Sofia and parents, with Looks good, Needs more and Not done (6f) | A parent sees only their child, and marking Not done reverses the rewards | Not started |
| 13 | Connections, easy tiers, and verified-by-platform | A forwarded email and a screenshot each create tasks; one is verified | Not started |
| 14 | Netlify preview and full security review | A fake parent cannot reach Emma's data | Not started |
| 15 | Switch Emma over | Old site and link shut off, repo private | Not started |
| 16 | Always-on agent and the vault | An agent in the cloud pulls with no app open; expired sign-in shows Reconnect | Not started |
| 17 | App Store | App on Emma's iPad | Not started |
| 18 | Edit backlog | One session per item | Not started |

## Decisions made
- Website host is Netlify. Vercel is not used.
- Text and email alerts are not at launch. Alert channels are separate pieces so they can be added later.
- The repo stays public until step 15, because GitHub Pages on a private repo needs a paid plan and Emma uses the live site every day. The old ntfy channel name is treated as exposed and is retired when alerts move into the app.
- (Nov 12) Claude scheduled tasks are only a stopgap for RSM until step 16. The real design is an always-on agent per PRD 6d.
- (Nov 12) Nothing aesthetic is fixed except the page set, the general layout of counters and buttons, safety rules and accessibility minimums. Colors have no fixed meaning: each theme defines its own color system. "No red, no black" is Emma's theme default only.
- (Nov 12) Rewards are reward packs: whatever the student is into (clothes, Star Wars, squishies). Items come from hand-made lists, pasted wishlists, web search, or connected accounts, and Sofia approves every item. The economy structure (earn rates, prices, box odds, shop size, box rules) is fixed and identical for every student; only the currency's look is customizable (default gold coins, or cash and so on). Theming depth depends on how into it the student is.
- (Nov 12) The whole product is built for ADHD brains (PRD 1a, docs/ADHD-RESEARCH.md): an eleven-point check every feature passes, and an optional ADHD profile at setup (PRD 6e) that tunes prompts, timing and tone, never the economy numbers.
- (Nov 12) No bad-day or hard-day mode (Sofia's decision). Plans still have slack and the Helper still adapts.
- (Nov 12) Rewards must be hard to cheat (PRD 6f): provisional rewards, layered proof checks that flag and ask instead of accusing, and adult review that can reverse rewards. A reversal is an undo, not a penalty.
- (Nov 12) Decided: an adult can reverse a task for 24 hours after she finishes; default proof strictness is normal; no daily coin cap. Adding an assignment goes through an AI intake that sets its value, and Emma never sets a value. Sofia consented to the AI checks for building and testing, and Annat's own consent should be recorded before Emma uses it for real.
- (Nov 12) Decided: photo proof may come from the camera or the camera roll; flagged items nobody reviews in 24 hours auto-confirm (with a reminder to the adults first); the plan to hold coins and make boxes wait for confirmation stands.
- (Nov 12) What Emma adds herself is the work nobody can pull in (studying, reviewing, practicing). It is judged against context (classes, calendar tests, projects), and claims that would raise the value, like a test date, stay unverified until confirmed.
- (Nov 12) Three separate helpers (PRD 6h): planner (Emma chose BB-8), tutor (C-3PO), checker (R2-D2). Jobs and permissions are fixed, names and looks are theme data. Official Star Wars names and art are undecided because of App Store risk.
- (Nov 12) Big assignments and projects: when one is posted, the planner tells Emma, asks about it, breaks it down across her week, and Emma approves or edits the plan. Sofia is told and can edit, but does not have to approve. Emma cannot change the due date the source set (PRD 6g).
- (Nov 12) The tutor talks like normal Claude, as if every message ended with "but don't give the answer": it explains and guides but never gives the final answer. This is fixed for every student, not a setting (PRD 6h).
- (Nov 12) Emma uses an iPad. Focus mode would use Apple's Screen Time framework, needs Apple's approval and Annat's approval, and comes after the App Store build.
- (Nov 12) Plan with her, not for her (PRD 6i, ADHD principle 11). Sofia noticed that when an AI schedules everything she forgets more. A quick research scan agrees in general (cognitive offloading can weaken memory for what was offloaded). The app keeps the record but keeps Emma making the plan: a skippable morning walk-through, her own if-then start plans, she chooses the order, and every change to her plan is shown to her.
- (Nov 12) Emma makes her own username and password and saves them wherever she wants. An adult creates the account and invite; adults never see or set her password.
- (Nov 12) The helper characters are original droids. Each student can name them and change their looks. Official Star Wars names and art are not used (PRD 6h).
- (Nov 12) Finishing a whole project earns nothing extra.
- (Nov 12) The weekly real prize budget is set by the parent. It is $40 for Emma today and may be lower later. The parent also chooses how the prize gets bought: alert only, one-tap checkout, or automatic buying that ships to the home. The app never stores a card or an address. Automatic buying is offered only where a retailer's ordering method has been tested; the suggested first release is alert only and one-tap checkout (PRD 6j).
- (Nov 12) Parents can change a short list of settings for their own child (prize budget and buying method, consents, their own alerts). Otherwise they are read-only.
- (Nov 12) Chat (planner and tutor) is on for Emma, with a parent's consent recorded in the app first.
- (Nov 12) The ADHD profile is entirely optional. Nobody has to fill it in at launch, and the app works with safe defaults.
- (Nov 12) Helper autonomy default is suggest only (Emma sees and accepts each change). Sofia can raise it per student, and Emma always sees every change. Project plans always need Emma's approval.
- (Nov 12) The database plan (docs/DB-PLAN.md) is approved. Mini box gives no coins (as the old code did). Check-offs always go through the normal flow with proof and normal coins, and the planner chat cannot check things off. "Give a box" becomes a logged button on the Yoda screen. The hold-then-confirm plan for coins and boxes stands.
- (Nov 12) Later: a clinician-fillable form a parent can upload at any time to personalize the app (PRD 6e). The setup question list is designed now so the form can be built from it.
- (Nov 12) The Helper is a planner that replans on events and schedules, not only a chat.

## Open questions for Sofia (the one live list)

### Needed now
Nothing. The database plan was approved on Nov 12.

### Needed at the step that builds it (nothing needed now)
1. App name. Not blocking: the technical bundle ID will be neutral, so the display name can change later.
2. Small fixed amounts for skill actions: starting, writing it down, packing, planning (step 7). I will propose numbers then.
3. Streak and threshold rules: keep or soften (step 7). I will propose options then.
4. Annat's own consent for the AI helpers, recorded in the app before Emma uses them for real (step 5).
5. Art for the original droids and their customizable parts (step 4), and the art approach for new collections (step 9).
6. Which interests and stores to test first for reward packs, which currency looks to offer, and which retailers to test for one-tap and automatic buying (step 9).
7. Parent daily summary, or only "day cleared" alerts; and which reminders Emma gets on her own device (step 11).
8. Which platforms connect first, and which have a feed or email option (step 13).
9. Free netlify.app address, or a custom one (step 14).
10. Someone with a clinical background to review the ADHD sections (PRD 1a, 6e, docs/ADHD-RESEARCH.md) before the app is shared beyond Emma. Optional but recommended.

### Later
11. The vault: sign in once and keep the session (recommended), or store school passwords (step 16).
12. A specific "personal agent" product to evaluate (step 16).
13. Annat's approval of the Screen Time permission for focus mode (after step 17).

## Session log
- 2026-11-12, step 1: read index.html, proof.html and backend/Code.gs. Wrote docs/PRD.md (new sections 3a, 6a), CLAUDE.md, this file, and docs/DB-PLAN.md. No app code and no live site files changed.
- 2026-11-12, step 1 revised (2): colors and look are fully per-student, rewards became reward packs, PRD 6c rewritten, house rules 6 and 7 and the themes tables updated.
- 2026-11-12, step 1 revised: added PRD 6b (Helper v2), 6c (per-student themes), 6d (connections and the always-on agent). Build order is now 18 steps. House rules 6, 7, 11, 12 and 13 updated. DB plan gained themes, plan history and connections tables.
- 2026-11-12, step 1 revised (3): researched ADHD and task completion (docs/ADHD-RESEARCH.md). Added PRD 1a (ten-point ADHD check), PRD 6e (ADHD profile at setup), and house rules 14 and 15. Economy structure made fixed for every student, only the currency look customizable (PRD 6c rewritten, house rule 6, DB plan).
- 2026-11-12, step 1 revised (4): removed the hard-day mode everywhere. Added PRD 6f (anti-cheating: provisional rewards, layered proof checks, adult review that reverses rewards), the later clinician form upload in PRD 6e, house rule 16, and integrity tables in the DB plan.
- 2026-11-12, step 1 revised (5): reversal window set to 24 hours, strictness default normal, daily cap dropped in favor of an AI assignment intake that sets the value, and a proposed hold-then-confirm design for coins and boxes (PRD 6f).
- 2026-11-12, step 1 revised (6): added PRD 6g (project and big-assignment planning), PRD 6h (planner, tutor and checker as separate characters and permissions), camera roll and auto-confirm decisions, and the corrected intake for tasks Emma adds herself. House rule 17 and DB tables for projects, tutor and helper characters added.
- 2026-11-12, step 1 revised (7): recorded the tutor rule (never gives the final answer), Emma on an iPad, and Emma approving her own project plans. Merged the two open-question lists into one live list here, grouped by step, because the PRD and this file had drifted in numbering.
- 2026-11-12, step 1 revised (8): added ADHD principle 11 and PRD 6i (keeping Emma in her own plan), research findings 9 and 10, and house rule 18, from Sofia's observation about AI-made schedules.
- 2026-11-12, step 1 revised (9): recorded Emma choosing her own username and password, original customizable droids, parent-set prize budget with alert, one-tap or automatic buying (PRD 6j), parents' short list of settings, chat on with parent consent, the ADHD profile being optional, and suggest-only autonomy. Trimmed the open questions to three real blockers.
- 2026-11-12, step 1 closed: the database plan is approved and the three old-code decisions are picked. Next is step 2 (database and security), in a new chat. It needs the Supabase project, token and network access from step 0.

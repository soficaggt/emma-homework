# Progress

Read this at the start of every session and update it at the end. Rules are in CLAUDE.md, requirements in docs/PRD.md.

## Status

| # | Step | Done when | Status |
|---|---|---|---|
| 0 | Accounts and keys (user does this) | Keys saved in the environment settings, open questions answered | In progress |
| 1 | Foundation: PRD, CLAUDE.md, this file, database plan | User approves docs/DB-PLAN.md | Done. Database plan approved Nov 12 |
| 2 | Database and security (including themes, connections, plan history) | Two fake students cannot see each other's data; a fake parent sees only their child; a student cannot forge coins or verified status | Done Nov 12. 736 security checks pass locally and on the real project |
| 3 | Logins and the Yoda screen | An adult can invite Emma, she chooses her own username and password and signs in, and a reset sends her a one-time link (adults never see her password) | Built Nov 12. Passed with fake accounts on the real project, except actually emailing the reset link, which waits for the email key (see below) |
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
- (Nov 12, buying method superseded below) The weekly real prize budget is set by the parent. It is $40 for Emma today and may be lower later. The parent also chooses how the prize gets bought: alert only, one-tap checkout, or automatic buying that ships to the home. The app never stores a card or an address. Automatic buying is offered only where a retailer's ordering method has been tested; the suggested first release is alert only and one-tap checkout (PRD 6j).
- (Nov 12) Parents can change a short list of settings for their own child (prize budget and buying method, consents, their own alerts). Otherwise they are read-only.
- (Nov 12) Chat (planner and tutor) is on for Emma, with a parent's consent recorded in the app first.
- (Nov 12) The ADHD profile is entirely optional. Nobody has to fill it in at launch, and the app works with safe defaults.
- (Nov 12) Helper autonomy default is suggest only (Emma sees and accepts each change). Sofia can raise it per student, and Emma always sees every change. Project plans always need Emma's approval.
- (Nov 12) The database plan (docs/DB-PLAN.md) is approved. Mini box gives no coins (as the old code did). Check-offs always go through the normal flow with proof and normal coins, and the planner chat cannot check things off. "Give a box" becomes a logged button on the Yoda screen. The hold-then-confirm plan for coins and boxes stands.
- (Nov 12) Later: a clinician-fillable form a parent can upload at any time to personalize the app (PRD 6e). The setup question list is designed now so the form can be built from it.
- (Nov 12) The Helper is a planner that replans on events and schedules, not only a chat.
- (Nov 12, step 2) Where the build differs from docs/DB-PLAN.md is listed at the end of that file ("As built in session 2"). The main ones: the Start button is server-written, only parents can record consent, the ADHD profile is reached only through two checking functions, and a new read-only `economy_config` table holds the one shared economy.
- (Nov 12, step 2) Migration files are the source of truth and are never edited after they are applied. Fixes go in a new numbered file (see `..0900_tuning.sql`).
- (Nov 12, step 3) Only the coach makes invites for now. Parents inviting can be added later.
- (Nov 12, step 3) Every account saves one email for password resets (for a student: hers or a grown-up's). Reset links go only by email, never on screen. A link works once, for 1 hour, and at most 3 reset emails per account per hour. This is the one addition to "collect the minimum" (house rule 5), chosen by Sofia.
- (Nov 12, step 3) The Delete account button is left for a later step (Apple needs it by step 17).
- (Nov 12, step 3) Coach powers need two-factor (an authenticator app). Without the code, the database treats a coach as having no role at all. Students and parents sign in with username and password only.
- (Nov 12, after step 3) Real prizes, replacing the earlier one-tap and automatic-buying ideas: the parent saves a card and shipping address once in a Stripe form inside the app (Stripe keeps both, our database keeps neither), taps Yes to pay for each earned prize within the budget, and Sofia orders it on whatever site sells it and ships it to the parent. House rules 5 and 19 and PRD 6j updated. Two-factor stays on for all coach accounts only.
- (Nov 12, step 3) Coach accounts can only be made by the developer script that emails the invite (supabase/scripts/send-coach-invite.mjs). The app has no way to make a coach.

## Open questions for Sofia (the one live list)

### Needed now (step 3 follow-up, see "What Sofia needs to do" below)
1. An email sender for reset links and your coach invite: a Resend account and two server secrets.
2. To email anyone other than yourself (Annat, or Emma's reset address), Resend needs a web address you own (a domain). This ties into question 9 below (custom address, about $12 a year).

### Needed at the step that builds it (nothing needed now)
1. App name. Not blocking: the technical bundle ID will be neutral, so the display name can change later.
2. Small fixed amounts for skill actions: starting, writing it down, packing, planning (step 7). I will propose numbers then.
3. Streak and threshold rules: keep or soften (step 7). I will propose options then.
4. Annat's own consent for the AI helpers, recorded in the app before Emma uses them for real (step 5).
5. Art for the original droids and their customizable parts (step 4), and the art approach for new collections (step 9).
6. Which interests and stores to test first for reward packs, and which currency looks to offer (step 9). Before building Stripe payments: check Apple's kids-app rules for a parent payment form, Stripe's terms for buying on a parent's behalf, and sales tax (PRD 6j).
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
- 2026-11-12, step 2: built the database in the Supabase project emma-homework: 44 tables, security on for every one, 9 migration files in supabase/migrations/ (applied and recorded). Wrote 736 security checks in supabase/tests/ that try to break the rules, plus scripts to run them locally (run-local.sh) and against the real project (run-remote.sh). All pass in both places. To check the tests can fail, I broke the rules on purpose 19 times in a scratch copy. The tests caught 16 straight away. The other 3 were rules locked twice over, so removing one lock changed nothing: for the "finished task cannot be edited" rule I removed both locks and the tests caught it; for the ADHD table I added a direct check on the read right; for a student moving her own time zone there is no separate check yet (the column guard alone still refuses it, and the test for it passes). The test run is always rolled back, so the real project holds no fake users or data (checked). Supabase's own security advisor shows no real problems; its remaining notes are intended (the ADHD table has no policy on purpose, and the 10 checking functions are meant to be callable). Not done on purpose: finishing a task, opening a box, buying and reviewing are server functions in steps 5, 7 and 12.
- 2026-11-12, step 3: built logins and the Yoda screen. Database: migration `20261113000100_logins.sql` (two-factor for coaches; invites, recovery emails, sign-in attempts and reset links in four tables the app cannot reach; 12 server-only functions), applied and recorded on the real project. Public sign-up is turned off in Supabase Auth and passwords need 8 characters. Server: two Edge Functions, `account-public` (look at and use an invite, sign in by username with a 5-try lockout, forgot password, reset) and `account-admin` (Yoda: make, list and cancel invites, email a reset link, sign out everywhere), deployed. App: a new Expo app in `app/` with sign in, invite (one question per screen), forgot, reset, the authenticator step, the Yoda screen and a simple home page. Checked: 826 database security checks pass locally and on the real project (90 new); 46 end-to-end checks through the deployed functions with a fake coach, student and parent pass; a 16-step browser walkthrough of the website passes; the app and both functions pass their type checks. Every test removed its fake accounts (the project was checked empty afterwards). Not checked: the reset email arriving (no email key yet), and the iPad app (needs Apple, step 17). No live site files changed.

## What Sofia needs to do (step 3 follow-up)
1. Make a free Resend account: go to resend.com, sign up, then in the left menu click API Keys > Create API Key, name it "homework", permission "Sending access", click Add, and copy the key.
2. Add it to Supabase: supabase.com > your project emma-homework > Edge Functions (left menu) > Secrets > Add new secret. Name `RESEND_API_KEY`, value: the key. Save. Add a second secret named `EMAIL_FROM` with the value `Homework <onboarding@resend.dev>`.
3. Tell Claude it is done. Claude then emails your coach invite to you (the code is never shown in chat) and re-runs the reset test with a real email.
4. Until you own a domain and verify it in Resend (Domains > Add domain), Resend only delivers to your own email address. So invite Annat's reset email and Emma's after that.
5. When the website has an address (step 14), add a secret `APP_URL` with it, so links in emails open the right place. Until then links point to a local test address, and the invite code can be typed on the invite page instead.

## What step 4 needs to know
- Sign-in state: `app/src/lib/auth.tsx` gives the session, the profile (role, first name, username) and whether a coach has done the authenticator step. `homeFor()` decides where each person goes. Students land on `app/src/app/home.tsx`, which step 4 replaces with the Days checklist.
- A new student already has a starter `themes` row named "Starter" with empty settings. Emma's theme (the kawaii look and her color legend) is filled into it in step 4, once her account exists.
- The neutral colors in `app/src/lib/ui.tsx` are only the frame before a theme loads; they carry no meaning.
- Server functions are deployed with `supabase/scripts/deploy-functions.sh`. Login tests: `supabase/tests/logins.e2e.mjs` (needs `NODE_USE_ENV_PROXY=1` in the cloud environment).
- Signing someone out everywhere ends their saved sign-ins at once; a login token they already hold keeps working until it expires, at most 1 hour.
- Consent is still recorded by the parent in the app (helper chat, tutor, connections, ADHD storage). Annat needs her own login for that before Emma uses the helpers for real.
- `read_adhd_profile()` and `save_adhd_profile()` are the only way to reach the ADHD profile.
- Storage: photos go in the `proof-photos` bucket under `<student id>/<task id>/<file>`. Opening one means calling `authorize_photo_open(path)` with the adult's login first, then making a short link with the service key.

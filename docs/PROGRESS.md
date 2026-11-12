# Progress

Read this at the start of every session and update it at the end. Rules are in CLAUDE.md, requirements in docs/PRD.md.

## Status

| # | Step | Done when | Status |
|---|---|---|---|
| 0 | Accounts and keys (user does this) | Keys saved in the environment settings, open questions answered | In progress |
| 1 | Foundation: PRD, CLAUDE.md, this file, database plan | User approves docs/DB-PLAN.md | Updated Nov 12, waiting for approval |
| 2 | Database and security (including themes, connections, plan history) | Two fake students cannot see each other's data; a fake parent sees only their child; a student cannot forge coins or verified status | Not started |
| 3 | Logins and the Yoda screen | Sofia can create "emma" and sign in as her | Not started |
| 4 | Days checklist in Expo, on theme settings | Looks and behaves like today's site, with colors coming from theme data | Not started |
| 5 | Start, egg, proof and photos | A photo uploads and only Sofia can open it | Not started |
| 6 | Calendar, Plans, bring-home list | Due dates stay off the daily list | Not started |
| 7 | Rewards engine driven by reward packs and per-student economy | A cleared day gives a box, rules match PRD 3a, values come from the theme | Not started |
| 8 | Helper v2: chat plus automatic rescheduling | Finishing late or adding homework triggers a sensible replan, undoable | Not started |
| 9 | Personalization: setup interview, themes, color systems, reward packs, item sources | A second fake student (for example into Star Wars) gets a different look, color meanings and reward pack from the interview | Not started |
| 10 | Move data from the Sheet and Drive | Emma's real history matches the old site | Not started |
| 11 | Notifications: bell inbox, then push | Finishing a task puts an alert in Sofia's bell | Not started |
| 12 | Proof board for Sofia and parents | A parent sees only their child | Not started |
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
- (Nov 12) Rewards are reward packs: whatever the student is into (clothes, Star Wars, squishies). Items come from hand-made lists, pasted wishlists, web search, or connected accounts, and Sofia approves every item. Currency and economy are adjustable per student but can stay default. Theming depth depends on how into it the student is.
- (Nov 12) The Helper is a planner that replans on events and schedules, not only a chat.

## Open questions for Sofia (PRD section 9)
1. Emma's username, and who keeps her password (needed at step 3)
2. Helper chat at launch: Sofia only, or on for Emma once Annat agrees (before step 17)
3. Which reminders Emma gets on her own device
4. Parent daily summary, or only "day cleared" alerts
5. App name and icon (needed before the Expo setup in step 4, because the bundle ID is hard to change later)
6. Free netlify.app address, or a custom one
7. Which platforms connect first, and which have a feed or email option (step 13)
8. The vault: sign in once in a live cloud browser and keep the session (recommended), or store passwords (riskier) (step 16)
9. Helper autonomy default: suggest only, small moves, or everything (step 8)
10. Art approach for new collections: drawn shapes, store images, generated art, or icons (step 9)
11. Is there a specific "personal agent" product to evaluate for step 16
12. Mini box coins, chat check-off coins, and gift box button (see DB-PLAN)
13. Which interests and stores to test first for reward packs (for example Depop, ThredUp, a Star Wars list), and confirm that "comedy" meant the currency

## Session log
- 2026-11-12, step 1: read index.html, proof.html and backend/Code.gs. Wrote docs/PRD.md (new sections 3a, 6a), CLAUDE.md, this file, and docs/DB-PLAN.md. No app code and no live site files changed.
- 2026-11-12, step 1 revised (2): colors and look are fully per-student, rewards became reward packs, PRD 6c rewritten, house rules 6 and 7 and the themes tables updated.
- 2026-11-12, step 1 revised: added PRD 6b (Helper v2), 6c (per-student themes), 6d (connections and the always-on agent). Build order is now 18 steps. House rules 6, 7, 11, 12 and 13 updated. DB plan gained themes, plan history and connections tables.

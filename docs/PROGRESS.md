# Progress

Read this at the start of every session and update it at the end. Rules are in CLAUDE.md, requirements in docs/PRD.md.

## Status

| # | Step | Done when | Status |
|---|---|---|---|
| 0 | Accounts and keys (user does this) | Keys saved in the environment settings, open questions answered | In progress |
| 1 | Foundation: PRD, CLAUDE.md, this file, database plan | User approves docs/DB-PLAN.md | Plan written, waiting for approval |
| 2 | Database and security | Two fake students cannot see each other's data; a fake parent sees only their child; a student cannot forge coins or verified status | Not started |
| 3 | Logins and the Yoda screen | Sofia can create "emma" and sign in as her | Not started |
| 4 | Days checklist in Expo | Looks and behaves like today's site | Not started |
| 5 | Start, egg, proof and photos | A photo uploads and only Sofia can open it | Not started |
| 6 | Calendar, Plans, bring-home list | Due dates stay off the daily list | Not started |
| 7 | Rewards: coins, box, Shelf, Shop | A cleared day gives a box, rules match PRD 3a | Not started |
| 8 | Helper chat | Chat works through a server function; 80 a day cap holds | Not started |
| 9 | Move data from the Sheet and Drive | Emma's real history matches the old site | Not started |
| 10 | Notifications: bell inbox, then push | Finishing a task puts an alert in Sofia's bell | Not started |
| 11 | Proof board for Sofia and parents | A parent sees only their child | Not started |
| 12 | Integrations and verified-by-platform | A test pull creates tasks and verifies one | Not started |
| 13 | Netlify preview and full security review | A fake parent cannot reach Emma's data | Not started |
| 14 | Switch Emma over | Old site and link shut off, repo private | Not started |
| 15 | App Store | App on Emma's iPad | Not started |
| 16 | Edit backlog | One session per item | Not started |

## Decisions made
- Website host is Netlify. Vercel is not used.
- Text and email alerts are not at launch. The alert design keeps channels separate so they can be added later without redoing anything.
- The repo stays public until step 14, because GitHub Pages on a private repo needs a paid plan and Emma uses the live site every day. The old ntfy channel name is treated as exposed and is retired when alerts move into the app.

## Open questions for Sofia (from PRD section 9)
1. Emma's username, and who keeps her password (needed at step 3)
2. Helper chat at launch: Sofia only, or on for Emma once Annat agrees (needed before step 15)
3. Which reminders Emma gets on her own device
4. Parent daily summary, or only "day cleared" alerts
5. App name and icon (needed before the Expo setup in step 4, because the bundle ID is hard to change later)
6. Free netlify.app address, or a custom one

## Session log
- 2026-11-12, step 1: read index.html, proof.html and backend/Code.gs. Wrote docs/PRD.md (with new section 6a and the exact old rules in 3a), CLAUDE.md, this file, and docs/DB-PLAN.md. No app code and no live site files changed.

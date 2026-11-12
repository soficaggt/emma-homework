# Emma's Homework: house rules

Read this file, docs/PRD.md and docs/PROGRESS.md at the start of every session. Do only the step the user names, then update docs/PROGRESS.md.

## What this is
A homework checklist for a 10-year-old (Emma) who has ADHD. Being rebuilt from a Google Sheet + Apps Script + GitHub Pages site into one Expo (React Native) app that also runs as a website on Netlify, with Supabase for logins, data, photos and server functions. The full requirements are in docs/PRD.md.

## Hard rules
1. **Never touch the live site files.** `index.html`, `proof.html`, `backend/Code.gs` and the two icon PNGs are what Emma uses every day. Do not edit, move, rename or delete them until the user says to switch Emma over (build step 14).
2. **Build the new app in `app/`.** Supabase SQL and server functions go in `supabase/` (migrations in `supabase/migrations/`, functions in `supabase/functions/`). Docs go in `docs/`.
3. **Never put secrets in code, commits, chat or docs.** That means API keys, tokens, passwords, push keys, automation keys, and the ntfy channel name. Secrets live in Supabase server secrets or the Claude Code environment settings. If one is needed, say what it is called and ask the user to add it. Commit a `.env.example` with names only.
4. **Every permission is enforced by Supabase Row Level Security.** Never rely on the app hiding a button. Every table has RLS on, with no public access. Anything the user must not be able to forge (coins, done-state math, verified-by-platform, box results, purchases) is written only by server-side functions, not by direct table writes from the app.
5. **Collect the minimum.** First name, schedule, homework, proof. No addresses, no school IDs, no school passwords. No third-party analytics or ads, ever (App Store kids rules).
6. **Keep the exact look.** Kawaii. Fonts: Fredoka (display), Nunito (body), Caveat (handwriting). Light and dark mode. The existing CSS variables and squishy drawings in `index.html` are the reference.
7. **Colors, in order of how necessary a task is:** purple (must do today) > blue > white (with a black outline) > pink > orange > yellow > green > gray (optional). **No red. No black.** Same saturation everywhere; each subject gets its own shade. The old Code.gs still lists red and black in its color list and in the Helper prompt: do not carry that over.
8. **No emojis** anywhere: not in the app, the Helper's replies, alerts, docs, commits or chat.
9. **No gambling-style mechanics.** Box odds and rules are in PRD section 3a and must be kept as written.
10. **Do not add logins by hand.** Use Supabase Auth only. No public sign-up: Sofia creates accounts.
11. **Never type or store a school password.**

## How we work
- One build step per session (list in docs/PRD.md section 8). Do not start the next step.
- Plan first for anything that changes the database or permissions: explain it in plain English, wait for approval, then write it.
- Develop on the branch the session gives you. Do not push to main. Do not open a pull request unless asked.
- Before finishing a step: run what can be run (type check, tests, SQL against a local or test project), say what you checked and what you could not, and state the "done when" line from docs/PROGRESS.md as passed or not.
- Update docs/PROGRESS.md at the end of every session: what was done, what is next, decisions made, anything left open.
- The user is not a developer. Explain choices in plain English, keep answers short, and give exact click-by-click instructions for anything they must do themselves.

## Tech choices (decided)
- Expo (React Native) with Expo Router, TypeScript. One codebase for iOS, iPad and web.
- Supabase: Auth, Postgres, Storage (private bucket for proof photos), Edge Functions, Realtime.
- Hosting: website on Netlify, app built with Expo EAS (no Mac). Vercel is not used.
- Time zone for "today": America/New_York, per student setting.
- Helper chat: Anthropic API called only from a Supabase Edge Function.

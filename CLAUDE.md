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
6. **Almost nothing aesthetic is fixed.** Only the set of pages, the general layout of counters and buttons, the safety rules (proof flow, who-sees-what, parent gates, no gambling mechanics) and accessibility minimums are fixed. Palette, fonts, shapes, icons, mascot, wording, page names, what the currency looks like (default gold coins), rarity names and art, and what is collected are per-student theme and reward-pack data (PRD 6c). The economy structure is NOT customizable: earn rates, prices, box odds, shop size and the box rules are identical for every student (PRD 3a, 6c). Emma's current look (kawaii, Fredoka, Nunito, Caveat, light and dark mode, the CSS variables and squishy drawings in `index.html`) is the first theme and must look the same as today for her.
7. **Colors have no fixed meaning.** Each theme defines its own color system: steps, colors, names and meanings, in the order the theme chooses (PRD 6c). Never hard-code a color or what it means in app logic or in the Helper prompt; read the student's legend. Emma's theme (purple to gray urgency ladder, no red, no black, same saturation, a shade per subject) is her default only. The old Code.gs red and black in its color list and Helper prompt must not be carried into her theme.
8. **No emojis** anywhere: not in the app, the Helper's replies, alerts, docs, commits or chat.
9. **No gambling-style mechanics.** Box odds and rules are in PRD section 3a and must be kept as written.
10. **Do not add logins by hand.** Use Supabase Auth only. No public sign-up: Sofia creates accounts.
11. **Never type or store a school password.** Platform connections use a sign-in the user does themselves in a live cloud browser, and only the resulting session is kept, encrypted (PRD 6d). If the user decides to store passwords instead, stop and get that decision written into PROGRESS.md first.
12. **The Helper is a planner, not just a chat.** It replans on events and on a schedule, from the server, with the autonomy level set per student, every change logged and undoable (PRD 6b). It never checks things off without proof or lets a moved task count as done.
13. **Automations run off-device.** Nothing important may depend on a phone, a browser tab, or Sofia's computer being open (PRD 6d).
14. **Built for ADHD brains.** Every feature passes the ten-point ADHD check in PRD 1a before it is built, and the session says in one line how it passes. Evidence and confidence levels are in docs/ADHD-RESEARCH.md. Never scold, shame, add pressure countdowns, loss or broken-streak penalties, or infinite feeds. Do not claim the app treats ADHD.
15. **ADHD profile data is sensitive health information (PRD 6e).** Optional, minimum, stored apart from task data, readable only by the coach, that student and her parent. No diagnosis or medication names required. Never in alerts, logs or analytics. Only derived settings go to the Helper, and only with parent consent.
16. **Rewards cannot be cheated (PRD 6f).** The server decides done-state, coins and box credit, never the app. Emma never sets a task's value: adding an assignment goes through an AI intake, and one that does not make sense earns nothing until an adult approves it. Proof is checked in layers (rules first, AI only when needed). Held coins are not spendable and a box waits until its tasks are confirmed. An adult can mark a task Not done within 24 hours of her finishing, which reverses its rewards; coins already spent are forgiven, never turned into a negative balance. The child's screen never says cheating or fake, and an honest child is not hard-blocked at the default strictness. A reversal is an undo, never an extra penalty. Every proof feature must be tested by trying to cheat it: junk task titles, filler text, reused text and photos, instant completion, and calling the reward functions directly as a student.

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
- Helper chat and replanning: Anthropic API called only from a Supabase Edge Function.
- Always-on agent (step 16): a separate small cloud service with a headless browser. Host not chosen yet.

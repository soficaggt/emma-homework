# The app (iPad, phone and website from one codebase)

Expo (React Native) with Expo Router. Screens are in `src/app/`, shared code in `src/lib/`.

- Settings: copy `.env.example` to `.env.local` and fill in the project's public URL and public (anon) key. Never the server key.
- Run the website locally: `npm install`, then `npm run web`.
- Type check: `npm run typecheck`. Build the website: `npm run build:web` (output in `dist/`).

Step 3 screens: sign in, invite, forgot password, reset, the coach's authenticator step, the Yoda screen, and a simple home page that step 4 replaces with the checklist.

## Step 4: the Days checklist

Students land on `/days` after signing in (`src/app/home.tsx` sends them there). Parents keep the simple home page until step 12.

Where things are:
- `src/theme/` reads a student's theme from the `themes` table (`parse.ts`), turns her color system into colors (`colors.ts`), loads fonts (`fonts.ts`) and hands it all to the screens (`ThemeProvider.tsx`). Nothing else in the app names a color or says what a color means.
- `src/logic/` the checklist's rules with no screen code (`tasks.ts`, `dates.ts`). This is what the unit tests cover.
- `src/data/` every database read and write (`repo.ts`), the board's state (`useBoard.ts`), and a development-only pretend database (`demo.ts`).
- `src/components/` the screen parts. `src/app/(student)/` the pages: Days, plus Calendar, Shelf and Shop as "coming soon" placeholders.

Theme data shape (the `themes` columns): `palette` `{light, dark}` with bg, bg2, card, fg, muted, line, accent, accentInk, good, alert, alertInk, ledge and the four tint/strong numbers; `fonts` `{display, body}` (names from `src/theme/fonts.ts`, anything else falls back to the system font); `shapes`; `wording` (keys in `src/theme/neutral.ts`); `page_names`; `currency` `{name, look}`; `color_system` `{mode, steps[], rules, shades[], typeSteps, subjects}`. A task stores `color_step`, an index into the student's steps. `theming_depth: rewards_only` keeps the calm neutral frame but still uses her color legend and currency; `light`, `medium` and `whole_app` all show the full theme until step 9 decides what differs.

Emma's look is `theme-data/emma.theme.json`. It is not in the app bundle: the app reads it from her `themes` row. Run `node scripts/theme-sql.mjs > theme-data/apply-emma-theme.sql` after editing the JSON, and paste that file into the Supabase SQL editor once her account exists (it fills her empty "Starter" row).

Her colors differ slightly from the old site in five places, all to meet the readable-contrast minimum (the tests check them): gray note text, the accent purple, button text on the dark-mode purple, text on the "due today" chip, and check box outlines fall back to the dark ink where the step color is too faint to see.

Look at it without an account: `EXPO_PUBLIC_DEMO=1 npm run web` (development only; the demo code is not in a production build). In the browser console, `window.__demoFail = "forbidden"` (or `"network"`) makes the next save fail so the calm error messages can be seen.

Checks:
- `npm run check` runs the type check and the unit tests.
- `tests/rls-app-check.sh` builds a throwaway local Postgres from `supabase/migrations`, then replays the checklist's exact reads and writes as a student, including everything that must be refused. Needs PostgreSQL 16 or 17.

Hooks for the next steps:
- Checking off: `onCheck` in `src/app/(student)/days.tsx` only shows a message. Step 5 replaces it with the server function (with proof). The student cannot write `done` or `coins`.
- Start: the next-task card (`src/components/NextCard.tsx`) is where the Start button goes.
- A task Emma adds herself has 0 coins and `source = student` (the database fixes both). It earns nothing until the step 5 intake or an adult sets its value.
- The coin counter adds up her `ledger` rows (confirmed, and held shown as "waiting"). It is display only; step 7 decides what counts and may replace it with a server-side balance.
- Not built here: drag to reorder (Move up and Move down in the details box instead), the bring-home list (step 6), the rewards strip and box (step 7), the Helper button (step 8), alerts to Sofia (step 11).

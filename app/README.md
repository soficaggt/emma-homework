# The app (iPad, phone and website from one codebase)

Expo (React Native) with Expo Router. Screens are in `src/app/`, shared code in `src/lib/`.

- Settings: copy `.env.example` to `.env.local` and fill in the project's public URL and public (anon) key. Never the server key.
- Run the website locally: `npm install`, then `npm run web`.
- Type check: `npm run typecheck`. Build the website: `npm run build:web` (output in `dist/`).

Step 3 screens: sign in, invite, forgot password, reset, the coach's authenticator step, the Yoda screen, and a simple home page that step 4 replaces with the checklist.

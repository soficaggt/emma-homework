# Emma's Homework: Full PRD (app + website)

Nov 9, 2026, by Sofia. Revised Nov 12, 2026 (section 6a added: integrations and verified proof).

## 1. What it is today

Emma's Homework is a cute, kawaii checklist that shows Emma (10, ADHD) what to do each day, makes her prove she did it, and rewards her with real squishies. Sofia plans the week with her once a week, and Claude keeps it updated. For the first month, the only goal is that Emma uses it to track her work.

| Piece | What it is now |
|---|---|
| Website | soficaggt.github.io/emma-homework, hosted free on GitHub Pages |
| Code | Public GitHub repo soficaggt/emma-homework: index.html (checklist, about 1,480 lines), proof.html (proof board, about 270 lines), backend/Code.gs (about 740 lines) |
| Data | A Google Sheet in Sofia's account, with tabs for Tasks, Template, Status, Days, Squishies, Ledger and Settings |
| Server | A Google Apps Script web app attached to that Sheet |
| Photos | A Google Drive folder called "Emma homework proof" |
| Alerts to Sofia | Texts through her Verizon email-to-text address, plus ntfy push |
| Helper chat | Claude Sonnet through the Anthropic API, max 80 messages a day |
| Last change | Nov 4: tests and due markers stay on the calendar, off the daily list |

## 1a. Built for ADHD brains (added Nov 12)

Direction: Emma's Homework is the first instance of a general app for children and teens with ADHD, and for anyone who struggles with executive function (starting, remembering, planning, managing time and feelings). Emma's setup is the first example, not the rule. The most important test for every feature in this PRD is whether it works for an ADHD brain.

The app is not a medical device. It does not diagnose or treat. It supports daily routines alongside treatment, and alongside the adults in the child's life. The evidence behind this section, with how strong each piece is, is in docs/ADHD-RESEARCH.md. That file is a quick literature scan, not a systematic review, and a clinician should review it and this section.

### The ADHD check: ten principles every feature must pass
1. **Make starting easy.** Starting is often the hardest part. Any task can have a tiny first step ("open the book to page 40", about two minutes). Start is one tap. The Helper proposes the first step.
2. **Put time and memory outside her head.** Visible timers and time bars, estimates compared with actual time ("Time Detective"), written bring-home and packing lists, and nothing that depends on remembering what someone said.
3. **One next thing.** Show what to do now, not everything. Today is the default view, with a clear next task. Keep choices per screen few. One instruction at a time.
4. **Fast, frequent, real feedback.** Feedback arrives at the moment of starting and finishing. Long-delay prizes (the weekly real pick) get visible progress and nearer steps. Rewards are real or tangible, not hypothetical.
5. **Reward the skill, not only the outcome.** The programs with the best evidence reward using the skills: writing it down, planning, packing, starting. Plan with the adult to fade rewards toward natural ones (praise, free time, grades) over time.
6. **Expect variable days.** Performance changes day to day with tiredness, medication timing and context. Plans have slack and the Helper adapts. There is no separate bad-day mode. A bad day is never punished.
7. **Protect feelings.** Frustration and shame derail kids with ADHD. No scolding, no pressure countdowns, no "you lost your streak" feeling. The wording is "a glitch to beat", never "lazy". Mistakes and late work get a plan, not a penalty.
8. **Fewer, calmer interruptions.** Notifications are both a tool and a distraction. Defaults are minimal. Animations and sounds can be skipped and respect reduce-motion. No endless feeds or lists.
9. **Adults stay in the loop, and watching is transparent.** Tested skills programs all rely on adult support, so the app supports Sofia and parents and does not replace them. Emma is told what Sofia can see and why ("Sofia can cheer you on"), not secretly watched.
10. **Different brains, different settings.** ADHD shows up differently (inattentive, hyperactive, combined; reward timing, time sense, emotions). Setup captures how it shows up for this student (6e), the app tunes its prompts, timing and tone to it, and Sofia reviews every change. The economy numbers do not change per student (6c).

### Where today's design needs a decision against these principles
- The Days tab can show 7 days at once: default to today with one clear next task.
- Sofia sees a live "working now" status and unchecks: tell Emma what is shared and why.
- Full box needs half the day, sparkle box needs three full days in a row, and moving work off today counts as skipping: review with a clinician so a miss never feels like a loss.
- Mystery boxes have random rarity: keep them earned by effort only, never bought with real money, and review them with a clinician.
- The real weekly pick is a week-long delay: add nearer milestones (the daily box already helps).
- The "Get ready for her call at 10pm" message in the check-off toast is a pressure message: replace it.
- Rewards today are for finishing only: add small fixed rewards for starting, writing it down, packing and planning (amounts decided in step 7).

## 2. Who uses it

Today it is really just Emma and Sofia, plus Annat through a special link. The new version keeps the same roles but gives everyone their own login.

| Role | Who | Today | In the new version |
|---|---|---|---|
| Jedi (student) | Emma, later more students | Opens the site on her iPad, no login | Own username and password, stays signed in. Sees only her own work |
| Yoda (coach) | Sofia | Same page as Emma, plus a key that unlocks the proof board | Own login with two-factor. Home screen is the proof board for every student |
| Parent | Annat, later other parents | Gets the special proof link | Own login, read-only, only their own child |
| Automations | Claude scheduled tasks in Sofia's browser (RSM daily, Schoology and Pearson on request) | Use the same Google link as everyone | A connection per platform per student, run by an always-on agent (see 6d), each with its own protected key tied to one student |

## 3. Every screen and feature today

The new app has to keep all of this, looking and feeling the same.

### Top of the page
- Title "Emma's Homework" with a range label ("Next 7 days")
- Coin counter in the corner; tapping it opens the Shop
- Rewards strip under the title (today's box status, progress)
- Five tabs: Days, Calendar, Shelf, Shop, and Emma's proof (only shows when Sofia's key is on the device)

### Days tab (the checklist)
- Shows the next 7 days, or just today (switch at the top)
- A weekly template fills in recurring tasks 7 days ahead: Robotics and Hunter tutoring every week, dinner every day. Biology, physics, Latin and Breaks do not repeat
- Plans (classes like RSM Algebra Saturday 10:40 to 1:10, Geometry Monday 5:50 to 7:20, tutoring) show on the list but can't be checked off and don't count toward finishing the day
- Everything edits in place: tap a title or note to change it. No Edit button, one + Add button per day, no clutter on cards
- Drag to reorder. Classes and dinner can't be dragged. Checked tasks move to the bottom
- Tap a task's color dot to open the details box: pick a color (or "Let it pick for me"), due date, note, how long, and type
- "How long things take" is hidden but can be turned on with a clock button
- Not going to do today sends a task to the Not today pile. It counts as handled, and "do today" brings it back
- What to bring home list for each night (vocab book, Hobbit, bio textbook) based on that night's homework
- Delete asks "Delete this?" first

### Colors (Emma's current theme: every part of this is a per-student setting, see 6c)
- Purple (must do today), then blue, white (with a black outline), pink, orange, yellow, green, and gray last (truly optional, almost never)
- No red, no black. Same saturation everywhere; each subject gets its own shade of the color

### Start and proof
- Start button: "What are you starting?" picker. Sofia sees it live until Emma checks it off or stops. A working pill with a wiggling egg sits at the bottom of the screen
- Pressing Start and then finishing the same task hatches the egg: +1 bonus coin
- Checking off opens "Nice work!": add a picture or screenshot, or explain what you did and why there's no picture. Every task needs proof except dinner
- Unchecking something Emma already finished sends Sofia a heads-up

### Calendar tab
- Due-date calendar for tests, quizzes, projects and "due" markers. These stay off the daily list
- Tap a day to see it and add items (Test, Homework due, Hunter, RSM, Plan)

### Rewards: Shelf and Shop
- Coins for finishing tasks; more necessary colors are worth more
- Mystery box when the whole day is cleared: "You're done! Congratulations!" celebration with glitter, then she opens the box and adds the squishy to her collection (or taps Later)
- Shelf: her collection of drawn squishies, each a real product (Five Below, NeeDoh, slime shops). Rarity matches how hard it is to actually buy. Never the same one twice
- Shop: 6 shelf items and 6 slime corner items, new every Monday. Common costs 25 coins, uncommon 45. Rare and legendary only come from boxes
- Real weekly pick: a fully cleared week earns a real squishy around $40 (legendary exception allowed). Sofia gets an alert to order it
- Tickets (like "unlock your phone") are built but turned off for now
- No gambling-style mechanics

### Helper chat
- "Helper" button at the bottom opens a chat. Example: "I did Latin, move Hobbit to Thursday"
- It can check things off, move tasks, put things in the pile, set due dates and colors, and plan work across days before it's due
- Replies in one or two short sentences, no emojis. Stops at 80 messages a day

### Proof board (proof.html)
- For Sofia and Annat, unlocked with Sofia's special link
- Pick a day (Today, Yesterday, weekday), see every finished task with its photo, note and time, and tap photos to see them big
- Has its own home-screen icon ("Emma's proof")

### Works like an app already
- Home-screen icons for the checklist and the proof board
- Light and dark mode
- Fonts: Fredoka, Nunito, Caveat

## 3a. Exact rules found in the old code (must be kept)

These are in backend/Code.gs and are easy to lose in a rebuild.

- **Day cleared:** a day is cleared when it has something to check off and every checkable item is done or in the Not today pile. Plans (type "fixed") are never checkable.
- **Full box vs mini box:** a full box needs at least half of the day's real work (dinner excluded) actually checked off. Otherwise it is a mini box: common squishies only. Moving a task off today counts the same as Not today (no dodging work by dragging it away).
- **Sparkle box:** a full box on a day when the two days before were also full boxes. Much better odds.
- **Box odds:** normal box is 2% legendary, 10% rare, 28% uncommon, 60% common. Sparkle box is 15% legendary, 35% rare, 30% uncommon, 20% common. Boxes never give a duplicate.
- **Coins:** each finished task gives 0 to 6 coins (default 3, more for more necessary colors, dinner 1). Pressing Start then finishing the same task adds +1 (the egg). Boxes give no coins (the Nov 1 commit message mentions 2 coins for a mini box, but the code does not do it; confirm with Sofia). The balance is the sum of finished-task coins plus the ledger (purchases are negative).
- **Real weekly pick:** a Monday to Sunday week where every day that had homework earned a box.
- **Shop:** a fixed shuffle seeded by the week, so it is the same all week and new every Monday. Only common and uncommon items are for sale. Already-owned items never appear.
- **Template:** dueInDays on a template row sets the due date (0 = due that night, 1 = due next morning).
- **Time zone:** America/New_York.
- **Proof types:** noProofTypes (default flex, fixed) and noAlertTypes (default flex) are settings, not code.
- **Task types:** test, school, hunter, rsm, fixed (Plans), flex (dinner and breaks).
- **Default colors by due date:** no pick means the app guesses: due within 1 day purple, 2 blue, 3 white, 4 pink, 5 orange, 6 yellow, 7 or more green.

## 4. Behind the scenes today, and what's wrong with it

### How it works now
- The page loads every task from the Google Script link and sends every change back to it. That covers add, edit, arrange, complete, uncomplete, start, stop, bring, buy, shelf, ticket and chat
- The link is saved in the browser the first time someone opens it
- Each morning the script fills in the next 7 days from the Template tab
- Proof photos are uploaded to the Drive folder. The proof board can only open them with Sofia's key
- Sofia gets alerts for: finished (with photo or note), started, stopped without finishing, put in Not today, unchecked, real squishy earned, and ticket used. Categories in the Settings tab's no-alert list stay quiet
- RSM homework is pulled every day by a Claude scheduled task in Sofia's desktop app browser, where she stays signed in. Schoology (Microsoft sign-in) and Pearson are pulled when she asks. Claude never types passwords

### Known bugs
- The Helper chat does not work at all right now (cause not yet found) and only reacts to typed messages. See 6b
- The Helper chat's color rules still list red, but the site has no red. Remove it from the chat's instructions (the old code also still lists red, black and other colors in its allowed color list)
- Edits made through the Google Sheet directly can clash with Emma editing at the same time
- If the computer is asleep, the daily RSM pull pauses

### Security gaps (why it has to move)
1. The code is public. Anyone can read the GitHub repo, including the ntfy alert channel name. ntfy channels are open to anyone who knows the name, so a stranger could follow Emma's alerts: task names, and when she starts and finishes.
2. The Google link is the only password. Anyone who gets it can read and change Emma's whole list, and it's saved on every device that ever opened it.
3. One shared key for the proof board. Everyone uses the same key. It can be forwarded, and you can't cut off one person without breaking it for everyone.
4. No accounts, no history of who changed what or who looked at photos.
5. It's a child's info: photos of a 10-year-old's work, her schedule and her school's name.

## 5. The new version: an app and a website

Like Instagram, it becomes one product with two doors: an App Store app on Emma's iPad and everyone's phones, and a website for any browser. Both run on the same code and the same backend, so a check-off on the iPad shows up on Sofia's phone right away.

- Emma (Jedi), Sofia (Yoda) and Annat (parent) use the App Store app (iPhone and iPad, built with Expo) or the website (on Netlify, same code as the app)
- Both doors talk to Supabase, the one shared backend: Logins (username + password, remembers her), Database (tasks, rewards, alerts, who-sees-what rules), Photo storage (private proof photos, links expire fast), Server functions (chat, alerts, pulls, secret keys live here)
- Supabase sends alerts through Apple push, powers the Helper chat through Anthropic, and receives homework from Claude scheduled tasks (RSM, Schoology, Pearson)

Everyone signs in through either door. Supabase holds the logins, data and photos, and only its server functions touch secret keys, Apple push and the outside services.

## 6. Requirements for the new version

### One app, two doors (like Instagram)
- Built once with Expo (React Native). The same code becomes the iPhone and iPad app on the App Store, and the website. Android can come later from the same code
- Website hosted on Netlify (free). App built and sent to Apple with Expo's cloud builds, so no Mac is needed
- Supabase is the shared backend: logins, database, photos and server functions. The app and the website see the same data instantly
- Emma's theme looks the same as today: kawaii, same colors, fonts, squishy drawings and celebration. Other students get their own look (6c)

### Logins: username and password, then it remembers her
- Sofia creates each account herself in the Yoda screen. There's no public sign-up
- Emma signs in once with a username (like "emma") and a password. The app keeps her signed in through Apple's secure Keychain, so she never types it again unless she taps Sign out or Sofia removes access
- On the website, "Remember me" keeps her signed in on that browser
- Optional: Face ID to reopen the app
- Sofia's login adds two-factor (an authenticator app). Parents get their own username and password
- Built on Supabase Auth (never a homemade login). Passwords are never stored in plain text, and too many wrong tries locks the account for a bit
- Sofia can reset a password or sign someone out of every device from the Yoda screen
- In-app Delete account button, which Apple requires for apps with logins

### Notifications live in the app
- A bell in the app and on the website with an inbox of every alert, marked read or unread
- Push notifications on the phone's lock screen through Apple's push service. These replace the Verizon texts and ntfy
- Sofia gets everything she gets today: finished (with the photo right in the alert), started, stopped, Not today, unchecked, real squishy earned, ticket used. One thread per student
- Parents can get a short daily summary and "day cleared" alerts, if Sofia turns that on
- Emma can get gentle reminders she can't turn into a distraction, like "History is due tonight" or "Your mystery box is ready"
- Each person picks which alerts they get in Settings
- Later (not launch): text and email as extra channels. Alerts are saved as rows first, then sent by a server function to each channel the person turned on, so adding a channel does not change the rest of the app

### Who can see what, enforced by the database
- A student only ever reaches her own tasks, proof, coins and collection
- A parent can only read their own child's proof and progress
- Only Sofia sees all students and edits templates, rewards and settings
- This holds even if someone opens the code and tries to call the database directly (Supabase Row Level Security)

### Data and photos
- Everything moves from the Google Sheet and Drive into Supabase once, then the Sheet is retired
- Proof photos go in a private storage bucket and open only through links that expire in minutes. They're shrunk on upload so the free 1 GB lasts
- Collect only what the app needs: first name, schedule, homework, proof. No home addresses, no school IDs, no school passwords

### Secrets stay on the server
- The Anthropic key, Apple push key and automation keys live in Supabase server secrets, never in the app or the code on GitHub
- The code repo becomes private

### More students
- Each student gets her own template, color shades, rewards, alert thread and parent(s)
- The Yoda home screen shows every student at a glance; tap one to open hers

### Automations
- RSM, Schoology, Pearson and Hunter tutoring pulls add tasks through a protected server function with its own key, one per student
- Hunter tutoring homework comes from two places, and all of it goes on the site: the TutorBird portal Emma's tutor shares with Sofia, and Remy's session notes, which are also sent to Sofia

### Then the edit backlog (from Oct 29)
- Due-date calendar much wider, with colors that match the daily list
- Due-today items never on the daily list (if shown, gray and at the very bottom)
- Egg hatching and Start fully built out so they feel worth clicking
- Rethink the coin system
- Emma picks one reward she's saving for, and the other options refresh (maybe daily)
- Reward options pull live from the internet when she wants
- The clinician form (6e): a fillable PDF with every setup question, and an upload a parent can use at any time to update the ADHD profile

## 6a. Integrations and verified proof (added Nov 12)

Homework comes from many outside platforms, and submitting there should count as proof.

- **Connect any platform.** Every task has a source (manual, template, rsm, schoology, pearson, hunter-tutorbird, hunter-notes, chat, or a new one) and an external ID from that platform. A re-pull updates the existing task instead of duplicating it. Adding a platform later means adding a new pull task, never changing the database.
- **Pulls stay protected.** Each pull task uses its own automation key, tied to one student, stored hashed, revocable by Sofia, and able to do only two things: add or update tasks, and mark a task verified. It can read nothing else.
- **Verified by platform.** If a pull sees that an assignment was submitted on the outside platform (for example "Submitted" on Schoology), the task is marked verified, with the platform name, the time, and an optional screenshot or link. A verified task counts as having proof: Emma does not need to add a photo, and Sofia sees "Verified by Schoology" on the proof board and in the alert.
- **Cannot be faked.** Only the automation key can set verified. Emma's own login cannot, and the database enforces it. Sofia can clear or override it.
- **Fallback.** If a platform cannot confirm anything (or the pull did not run, for example the computer was asleep), Emma's photo or note works exactly as it does today.
- **Per-task proof rule.** Each task has a proof rule: photo or note (default), or platform. A task can accept either.
- **Honest limit.** Pulls depend on those platforms' pages and on Sofia's computer being awake. Verified status is a convenience on top of normal proof, never the only path.
- **Passwords.** Claude never types or stores a school password. Pulls run in Sofia's already signed-in browser, as today.

## 6b. Helper v2: a planner that keeps rescheduling (added Nov 12)

The old Helper does not work today and only reacts when someone types. The new Helper is the planner for the whole week.

- **Always replanning.** It reschedules on its own whenever something changes, not only when someone chats: a task is finished, skipped, moved or runs late; new homework arrives from a platform; a due date or test is added; the day ends with work left over; Emma starts a task and takes much longer than planned.
- **It knows the situation.** It reads the student's tasks, due dates, how long things really take her (learned from Start and finish times), classes and Plans, the Not today pile, and the day's progress.
- **Guardrails, set per student by Sofia.** Three levels: suggest only (a card Emma or Sofia taps to accept), apply small moves and tell Sofia, or apply everything. Default is suggest. It never deletes tasks, never checks things off without proof, never counts a moved task as done, and never breaks the "moving work off today counts as skipping" rule. Every change is written to a history with who or what made it, and any change can be undone with one tap.
- **Chat stays.** Emma (if allowed) and Sofia can still type "I did Latin, move Hobbit to Thursday". Replies are one or two short sentences, no emojis. Cap per user per day (80 to start), enforced by the server.
- **How it runs.** A server function calls the Anthropic API. It runs on events (task changed, new homework pulled) and on a schedule (morning, after school, evening, end of day), so no phone or browser has to be open. The key never leaves the server.
- **It must actually work.** Before building, find out why today's chat fails (missing key or workspace ID in the script properties is the likely cause) so the cause is not carried over.
- **Cost control.** Each student has a daily call budget. Replans only run when something changed.
- **Launch rule (App Store).** Chat with Emma is off until Sofia and a parent turn it on (PRD section 7). The background replanner works on task data only and sends no child-typed text to anyone else.

## 6c. Everything is customizable per student: themes, colors, rewards, interests (revised Nov 12)

Only the structure and the safety rules are fixed. How it looks, what the colors mean, and what a student collects are all per-student settings. Emma's current setup is the first example, not the rule.

### What stays fixed for every student
- The set of pages exists: Days, Calendar, the collection page, Shop, proof, Helper, the bell inbox, Settings. Their names and icons can change ("Shelf" can become "Closet").
- The general layout of counters and buttons: a coin counter in the corner, tabs, one + Add per day, Start, check off.
- Safety and access rules: the proof flow, who-sees-what, parent gates on links out and purchases, no gambling-style mechanics, and accessibility minimums (readable contrast, large tap targets, a reduce-motion option).

### What is customizable
Palette, fonts, shapes and corners, icons, the mascot and what "hatches", celebration style, wording and tone, page names, what the currency looks and is called, rarity names and art, what is collected, and how much of the app is themed at all. The economy itself (how coins are earned, what things cost, box odds, shop size) is not customizable: see "Currency and the economy" below.

### Colors do not have a fixed meaning
- Each theme has a **color system**: a list of steps (any number), each with a color, a name and a meaning, in an order the theme chooses. A system can be an urgency ladder (Emma's: purple for must do today down to gray for optional), colors by subject, colors by task type, or no colors at all.
- A task stores a step from that student's system. The Helper reads the student's color legend every time it plans, so it never relies on hard-coded colors or meanings.
- The "guess from the due date" rule works on whatever ordered steps the theme defines, if it is an urgency ladder.
- Emma's rules (no red, no black, same saturation, each subject a shade) belong to her theme only.

### Reward packs: whatever the student is into
- A **reward pack** is: what is collected and what it is called, where items come from, how rarity works, and the art style. Squishies are Emma's pack. Others: clothing (Depop, ThredUp, wishlists), Star Wars (characters, LEGO sets, cards), plants, trading cards, makeup, books, anything.
- A pack can give **digital collectibles** (free, kept in the app), **real prizes** (the weekly pick, within a budget, ordered by Sofia or a parent), or both.
- **Where items come from, easiest first:**
  1. A list Sofia or a parent builds by hand.
  2. A pasted link to a public wishlist or collection that the Helper reads.
  3. The Helper searches the web for things matching the student's interests, and Sofia approves.
  4. A connected account through the always-on agent (6d) for wishlists that need a sign-in.
- **Honest limits:** many stores have no public way to read wishlists and some block automated reading, and terms differ. Nothing is promised for a specific store (Depop, ThredUp, others) until it is tested in step 9, and each store is checked before it is offered.
- **Every item** has a name, image or art, price, link, tags, rarity and a status (proposed or approved). Sofia approves every item before a child sees it. Links out and anything to buy sit behind a parent gate.
- **Rarity** per pack: from real price and how hard the item is to get (as with squishies), from a set the pack defines (rare characters), or chosen by Sofia.
- **Art** per pack: drawn shapes (Emma's squishies), a product image from the listing (check each store's terms), generated art Sofia approves, or icons. Licensed characters such as Star Wars raise trademark questions: names and links are likely fine for a private unlisted app, but check before using official images, because App Review can flag them.

### Currency and the economy: the structure is fixed, the look is not
- **The way money works is the same for every student.** How coins are earned (PRD 3a), what things cost, the box odds, the weekly shop size and refresh day, and the rules for full box, mini box, sparkle and the real weekly pick do not change per student. Earn rates and prices are not adjustable. This keeps the economy fair and predictable, and the Helper and the app can rely on it.
- **Items are priced in coins by rarity only:** common 25, uncommon 45, and rare and legendary come only from boxes. This holds for every reward pack.
- **What the currency looks like is customizable.** The default is gold coins, which look the same for everyone unless changed. Other skins: cash or bills, stars, gems, credits, tokens, whatever fits. The name and the picture change, never the numbers.
- Only Sofia (not the student) changes the skin. Adults can still give a box or coins by hand, always logged.
- To confirm: the real weekly prize budget (about $40 for Emma) is real money, not an in-app rate, so it is likely an adult setting per student.

### How into it is the student: theming depth
- A per-student setting from "just the rewards" to "the whole app looks like it". A student who is mildly into clothes may only get a clothing pack. A student who loves Star Wars may get Star Wars colors, mascot, wording, celebration and rewards.

### Setup interview
- When Sofia adds a student, the Helper asks plain questions: interests, how into them, favorite colors and style, what the colors should mean to her (or whether to use colors at all), what a real prize is and its budget, what her week looks like, and how ADHD shows up for her (6e). It builds the theme, the reward pack and a starter catalog, and Sofia reviews and edits everything before it goes live. The same interview can be re-run later when interests change.
- Sofia can duplicate a theme, change it, or move a student to another one without losing her collection.

## 6d. Connections: homework from other platforms, running without an app open (added Nov 12)

Claude scheduled tasks in Sofia's own browser do not work beyond one household: they stop when the computer sleeps, sign-ins fail, and people get stuck in a confusing in-app browser. The new version gets homework through three tiers, from most reliable to least.

1. **Feeds, email and official links (preferred).** Where a platform offers a calendar feed, an API or email notifications, use that. Each student gets a private inbox address, so tutor notes (like Remy's) and platform emails can simply be forwarded in, and the Helper reads them and creates tasks. These need no passwords and no browser.
2. **Always-on connected browser (a live agent).** For platforms with nothing better (Schoology behind Microsoft sign-in, Pearson, TutorBird), a small agent runs on a computer in the cloud that is always on, with its own headless browser, whether or not any app is open. It runs on a schedule and on demand, reads assignments and submission status, and sends tasks and verified status to the student's account through that student's protected key.
   - **Connecting once.** In the app the user taps Connect, a live window of the cloud browser opens, they sign in themselves (including any two-factor step), and the agent keeps that signed-in session in an encrypted vault. Passwords are not typed into the agent and not stored where possible. This is the safer shape of the "vault" idea.
   - **When a sign-in expires** (Microsoft sessions do), the connection shows "needs reconnect" and the user gets an alert with a Reconnect button. It never silently fails.
   - **Per student, per platform.** A `connections` record holds the platform, the student, status (working, needs reconnect, paused), last run, and last error. Sofia sees all of them in one place; a parent sees only their child's.
   - **Always on.** This is a separate small service (not Supabase or Netlify), so it has a monthly cost. Pick the host at step 16.
3. **Manual fallback.** Snap a screenshot or paste text of a portal and the Helper turns it into tasks. Always available, and the thing to use when a connection is down.

Rules for all tiers: only a student's own key can write that student's tasks; connections can add and update tasks and mark them verified, and nothing else; school passwords are never kept in the app database or in code; every connection needs the parent's OK before it is turned on, and some schools' rules may forbid automated sign-in, so each platform is checked before it is offered. Everything a connection does is in the audit log.

Open question: the user referred to a "personal agent" product. The requirement is written generally (any always-on agent with a vault and its own browser). If a specific product is intended, name it so session 16 can evaluate it.

## 6e. The ADHD profile: "How I work" (added Nov 12)

ADHD does not look the same in every person. During setup, each student gets a short profile of how it shows up for her, so the app can fit her instead of using one default for everyone. It is a support setting, not a diagnosis, and it never produces a severity score.

### Who fills it in
- At launch: Sofia or a parent, together with the student, using plain questions in the app. The student gets a kid-friendly version she can read and edit.
- **The clinician form (planned, after launch; the question list is designed now so the form can be made from it).** One standard form containing every question the app needs, designed so a psychiatrist or therapist can fill it in. It comes as a fillable PDF and a printable one. A parent can upload a completed form at any time, now or months later, to personalize or re-personalize the app.
  - The app reads the answers straight from the form's fields, so no AI has to read a clinical document. A handwritten or scanned form is typed in by the parent, or read by AI only if the parent consents.
  - After an upload, the parent sees what the app understood, in plain words, and approves it before anything changes. Every upload is a new version; the parent can see what changed and go back.
  - The uploaded file is not kept unless the parent chooses. The approved answers are kept.
  - The form's questions are exactly the list below, so the form and the app never drift apart.
  - A portal where the clinician fills it in online is a later idea, not part of this.

### What it asks (plain language, all optional)
- **Starting:** how hard is it to begin? What helps (a tiny first step, someone nearby, a timer, music)?
- **Staying with it:** what pulls her away? How long before she needs a break? Does she need to move or fidget?
- **Time sense:** does she tend to underestimate or overestimate how long things take? Does she need to see time?
- **Remembering:** does she forget what to bring or what was said? What written cues help?
- **Planning and big projects:** can she break things down alone, or does she need help?
- **Switching:** are changes between activities hard? How much warning helps?
- **Feelings:** how does she react to frustration, mistakes, correction, or missing a goal? What helps her reset? What words should never be used?
- **What motivates her:** interest, novelty, choice, praise, surprise, or deadlines? Does she like surprise rewards or predictable ones?
- **Her best and worst times of day** for focus, in the family's own words. No medication names or doses are asked for, only windows ("sharp after breakfast, tired after 7").
- **Environment:** noise, music, where she works best.
- **What has worked and not worked** before.

### What it controls
First-step size, timer and time-bar style, break lengths, how much slack plans have, how many items are shown, reminder style and timing, how feedback and nearer milestones are presented, surprise versus predictable rewards, tone and words, and when the hardest tasks get scheduled. It never changes the coin amounts, prices or box odds (6c).

### It keeps learning, with Sofia in charge
- The app records estimates against actual time, when she starts and stalls, and which times of day go well. The Helper proposes profile changes ("homework after 7 is slower, move the hard work earlier?"). Sofia approves. Nothing changes silently.

### Privacy and consent (this is sensitive health information)
- Entirely optional, and the minimum is collected. No diagnosis names or medication names are required.
- Stored apart from ordinary task data. Readable only by the coach, that student, and her parent. Never shared with other students or parents, and never shown in alerts or logs.
- The Helper receives only the derived settings and short plain-language notes, not the raw answers or any clinical document, and only with the parent's consent. Clinician documents are not stored unless a parent chooses.
- It must be disclosed in the privacy policy and App Store privacy labels, covered by the parent's written consent (PRD 7), and deletable on request.

## 6f. Integrity: rewards that are hard to cheat (added Nov 12)

The problem: kids will look for the fastest route to the reward. Emma adds assignments with random names and checks them off with random text in the proof box. That backfires. She earns rewards for work that was not done, the plan stops being true, and the adults stop trusting it. Cheating is also a signal that a task feels too big or the reward feels too far away, and the app treats it that way, without shaming.

### Principles
- **The server decides, never the app.** Done-state, coins and box credit are worked out in server functions (house rule 4). A student cannot write her own rewards or approve her own work.
- **Layers, cheapest first, with adults as the backstop.** No automatic check is perfect, and a wrong block hurts an honest child with ADHD. So the checks flag and ask, and adults decide.
- **Never accuse.** The child's screen never says "cheating" or "fake". It asks for more detail in a kind way.

### Layer 1: which tasks count, and who sets their value
- Every task records its source: the template, Sofia, the Helper, a connected platform, or "added by Emma".
- **Emma never sets a task's value.** A task's value (its coins) follows from its priority and size using the fixed table (PRD 3a). Tasks from the template, Sofia, the Helper or a platform arrive with a value already. For a task Emma adds herself, an AI sets the priority step (from her own color legend) and the size.
- **Adding an assignment goes through a short AI intake,** so a made-up task has nothing to cash in:
  1. She types a name. The app first matches it against what it already knows (her classes, pulled assignments, tests on the calendar, past tasks). This is quick and sends nothing anywhere.
  2. If it matches ("Latin vocab" and she takes Latin), the AI proposes the subject, due date, how long it should take and the priority step, and shows one card: "Latin vocab, about 20 minutes, due tomorrow. Right?" She taps yes or fixes it.
  3. If it does not match or is vague, a short chat of one to three questions: "Which class is this for? When is it due? What do you have to do?" The AI checks that her answers make sense and sets the value.
  4. If it still does not make sense, the task is saved as "waiting for Sofia". She can see it, but it earns nothing until an adult approves it and sets its value. The app tells her kindly ("Sofia will look at this one").
- Duplicates, tasks finished within seconds, and tasks finished much faster than their estimate are flagged.
- **It has to be fast.** Quick matching comes first and the AI step should take a couple of seconds, because waiting is hard for an ADHD brain.

### Layer 2: checking the proof when she submits
- Instead of a blank box, the app asks one or two specific questions made from the task, such as "Which problems did you do? Which one was the trickiest?" Specific questions are easier for an ADHD brain than "explain what you did", and the answers show whether the work really happened. A short, true answer can pass. Length is not the test.
- **Rule checks run first** and send nothing to anyone: too short, gibberish, the same text reused on other tasks, filler only.
- **An AI check runs only when needed.** Does the answer make sense for this task and subject? Is it specific? Is it consistent with the assignment (its title, note and class)? For photos: does it show relevant work, such as a page with writing or a worksheet, rather than a blank wall or something unrelated? Photos are also compared with earlier photos to catch reuse. Where possible a photo must come from the in-app camera, with screenshots allowed only for online work.
- **Results:** pass; "needs a bit more" (a kind prompt, up to two tries, no penalty); or still unclear. If still unclear, the answer is accepted but flagged, and the rewards stay provisional until an adult looks.
- **Strictness is set per student by Sofia:** gentle (flag only), normal (ask for more up to twice, then accept and flag; the default, decided), or strict (she cannot submit until it passes or an adult approves in person).
- **Ways to prove that are not writing:** a photo, a short answer, or "show Sofia in person", so a child who finds writing hard is not blocked. Voice answers are not planned for launch because they send a child's voice to a third party.
- **Privacy and consent:** only what the check needs goes to the AI provider: the task name, her short answers at intake, and that task's proof text and photo. Quick matching and rule checks run first, so most steps send nothing. Sofia has consented for building and testing. Because Emma is a child and Annat is her parent, Annat's own agreement should be recorded in the app before Emma uses it for real (PRD 7). The provider's retention terms are confirmed before launch.

### Layer 3: adult review that can reverse rewards
- On the proof board, every finished item has three buttons: **Looks good**, **Needs more**, **Not done**.
- **Looks good:** the rewards become confirmed.
- **Needs more:** the task goes back to Emma with a kind note, and its coins stay held until she adds more.
- **Not done:** the task goes back to unchecked, its coins are removed, its credit toward the day's box is removed, and an optional reason is recorded. Emma sees a calm message in her inbox, for example "Sofia reopened Latin vocab. Finish it to earn the coins back." If the coins were not spent yet, she earns the same coins when she does it properly. The reversal is an undo of rewards she did not earn. Nothing extra is taken. See "What happens to coins and boxes" below for the case where they were already spent.
- Reviews stay open for 24 hours after she finishes (decided). After that, rewards are final.
- Sofia and parents can both review, and every review is written to the audit log.
- Patterns go to Sofia, not to automatic punishment: "3 items flagged this week, mostly after 8pm", so the adults can talk with Emma. The Helper also notes where flags cluster (very long tasks, certain subjects), because that may mean the work feels too big, and it suggests splitting the task or adding a nearer reward. That is a design stance, not a researched finding.

### What happens to coins and boxes: prevent, instead of take back (proposed, needs your yes)
Taking back spent coins or opened boxes is messy, so the design avoids needing to.
- **Coins have two states:** confirmed (spendable) and held (shown in the counter with a gentle "waiting" look, not yet spendable). The coin animation still plays the moment she finishes, so the feedback is immediate.
- **Most coins are confirmed at once.** That happens when the task came from a trusted source or passed the AI intake, the proof passed the checks, and nothing was flagged.
- **Held coins are confirmed** when an adult taps Looks good, or automatically 24 hours after she finished if nobody has looked. She is never punished for an adult being busy, and Sofia gets a nudge about unreviewed flagged items.
- **A box opens only when every task that counted toward that day is confirmed.** Usually that is immediate. If something was flagged, the box waits, at most 24 hours.
- **Not done, within the 24 hours,** removes the held or unspent coins and the box credit for that task. In the rare case her coins were already spent or her box already opened (the checks passed but an adult disagreed), the spent part is forgiven: no negative balance, nothing taken from future earnings, and the item stays. The task reopens, she needs to do it, and it does not pay a second time. Sofia gets a flag so the adults can talk about it, and may raise that student's proof strictness for a while.
- After 24 hours, everything is final.

### How this fits the ADHD check (1a)
- Feedback stays immediate, because coins show the moment she finishes, even when they are held (principle 4).
- The wording never shames, and honest children are not hard-blocked by default (principle 7).
- Specific questions lower the memory load of explaining (principle 2).
- **One real tension:** a reversal is the one place the app takes rewards away, and principle 7 warns against loss that feels like a penalty. It is kept to rewards for work that was not done, it has a clear way to earn them back, the wording is calm, and an adult makes the call. Confirm this with a clinician.

### Honest limits
A determined child can still write plausible text or photograph someone else's work. The goal is to make cheating not worth the effort and to catch patterns early. Adult review is the real backstop. Verified-by-platform proof (6a) is the strongest where it exists. The best defense is also the design: a fixed economy, values set by the AI and adults rather than by her, and tasks that do not feel impossible.

## 7. App Store reality check

The App Store is doable. The catch is that an app for kids gets Apple's strictest rules, so the app has to be built for them from the start.

- **It must be a real app, not a website in a shell.** Apple often rejects apps that just wrap a website. Building with Expo, with real push notifications, the camera for proof photos and Face ID, avoids this
- **Cost:** the Apple Developer Program is $99 a year, as an individual. If it lapses, the app disappears from the store. You have to be an adult to enroll, and it's in your name
- **No Mac needed:** Expo builds the app on its own cloud Macs and uploads it to Apple. You test it on a real iPhone or iPad through Apple's TestFlight app
- **Unlisted is the best fit.** Apple can make an app "unlisted": it's a real App Store app, but it doesn't show up in search or charts. Only people with your link can download it. You ask Apple for this after the app is ready, with a note in the review form. The link isn't secret, but the logins still protect everything
- **Rules for apps meant for kids:**
  - No third-party ads or analytics, and no sending kids' data to third parties
  - Links out of the app and anything to buy need a parent gate, like a question only an adult can answer. This matters for "order this squishy" links
  - Only collect what the app needs
  - The Helper chat is the risky part: it sends Emma's messages to Anthropic. Safest plan for launch: the chat is for Sofia only, or a parent turns it on with consent. Decide before submitting
- **Privacy policy:** Apple requires a privacy policy link and "privacy nutrition labels" saying what data the app collects
- **Review:** every update goes through Apple's review, usually a day or two. Small fixes to the website go live instantly
- **Parent consent:** before students who aren't Emma, get each parent's written OK on what's collected and how to delete it. A US kids' privacy law (COPPA) covers apps for under-13s. This isn't legal advice, so read up before it grows

## 8. Build order

The website goes first because it's fastest to switch Emma to. The App Store comes after, from the same code. One piece per Claude Code session, checked before moving on. Progress is tracked in docs/PROGRESS.md.

1. Foundation: PRD, house rules, progress file, database plan
2. Supabase database and the who-sees-what rules (including themes, connections and plan history)
3. Logins and roles, plus a Yoda screen where Sofia creates accounts
4. Days checklist in Expo, built on theme settings from day one (Emma's look is the first theme), with the ADHD check (1a): today by default, one clear next task, first-step prompt
5. Start, egg, proof and photos, with the AI assignment intake and the layered proof checks (6f)
6. Calendar, Plans and the bring-home list
7. Rewards engine: coins, mystery box, Shelf and Shop. One fixed economy for everyone, with per-student currency looks and catalogs, plus small rewards for skill use (1a), and provisional rewards that an adult can reverse (6f)
8. Helper v2: chat plus automatic rescheduling (6b)
9. Personalization: the setup interview including the ADHD profile (6e), theme editor and per-student catalogs and art (6c)
10. Move the data from the Google Sheet and the photos from Drive
11. Notifications: the bell inbox, then push to phones
12. Proof board for Sofia and parents, with Looks good, Needs more and Not done (6f)
13. Connections, easy tiers: private inbox address, feeds and manual screenshot upload, plus verified-by-platform (6a, 6d)
14. Website on a Netlify preview link, tested with a fake student and a fake parent, then a full security review
15. Switch Emma: sign her in on her iPad, give Annat her own login, shut off the old Google link and shared key, make the repo private. The existing RSM scheduled task is pointed at the new version as a stopgap
16. Always-on agent: the cloud computer with a browser, the Connect and Reconnect flow, and the vault (6d)
17. App Store: Apple Developer Program, TestFlight, privacy policy, unlisted request
18. The edit backlog

## 9. Costs, open questions and sources

| Thing | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99 a year | Only needed once you're ready to test on the iPad. The app disappears if it lapses |
| Supabase | Free, then $25 a month | Free projects pause after 7 days with no activity (daily use keeps it awake) and have no backups. Upgrade once there's a second student |
| Netlify | Free | Website hosting |
| Expo | Free to start | The free plan gives a few cloud builds a month, in a slower line |
| Anthropic API | Pay as you go | Helper chat only |
| Custom web address | About $12 a year | Optional |
| Always-on agent computer (step 16) | Roughly $5 to $25 a month to start (host to be chosen), plus Anthropic usage per pull | Needed for platforms with no feed or email option. Cost grows with students and platforms |
| Text or email alerts (later) | Email is nearly free; text costs a little per message and needs carrier registration | Not for launch |

Year one minimum is about $99 plus Helper chat usage.

### Open questions
1. What's Emma's username, and who keeps her password: Sofia or Annat?
2. Helper chat at launch: Sofia only, or on for Emma once Annat agrees?
3. Which reminders should Emma get on her own device, if any?
4. Should parents get a daily summary, or only "day cleared" alerts?
5. App name and icon for the App Store. Keep "Emma's Homework," or a name that fits more students?
6. Free netlify.app web address, or a custom one?
7. Which platforms must connect first (RSM, Schoology, Pearson, TutorBird, Remy's emails), and which have a feed or email option?
8. The vault: sign in once in a live cloud browser and keep the session (recommended), or store usernames and passwords? The second conflicts with "no school passwords" and is riskier for a child's accounts.
9. Helper autonomy default: suggest only, small moves automatic, or everything automatic?
10. What art approach for new students' collections: recolorable shapes, reviewed generated images, or icon sets?
11. Is there a specific "personal agent" product you want evaluated for step 16?
12. Who fills in the ADHD profile in the app at launch (Sofia, Annat, Emma)? Will a clinician review section 1a and docs/ADHD-RESEARCH.md, and help design the later clinician form?
13. What small fixed amounts should skill actions earn (starting, writing it down, packing, planning)?
14. Streak and threshold rules (full box needs half the day, sparkle needs three days in a row, no dodging): keep or soften?
15. Is the weekly real prize budget (about $40) an adult setting per student?
16. Which currency looks to offer: gold coins (default), cash, others?
17. Do you approve the "prevent, instead of take back" plan for coins and boxes in 6f (held coins, boxes that wait for confirmation, spent coins forgiven)?
18. If a flagged item is not reviewed within 24 hours, is auto-confirm OK, or should it stay held until an adult looks?
19. Photo proof: in-app camera only, or camera roll too (screenshots allowed for online work)?
20. Annat's own consent to send Emma's task names, answers and proof to the AI checker, to record before real use.

### Sources
- Claude Code in the cloud: quickstart
- Apple: Unlisted app distribution
- Apple: Developer Program fee waiver page (lists the $99 fee)
- Apple: guideline update on kids' apps and third-party data
- Expo: Submit to the App Store with EAS
- Expo: App Store submission without a Mac
- Supabase: Do projects pause when inactive?
- Supabase: free tier limits 2026

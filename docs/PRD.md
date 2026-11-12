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

## 2. Who uses it

Today it is really just Emma and Sofia, plus Annat through a special link. The new version keeps the same roles but gives everyone their own login.

| Role | Who | Today | In the new version |
|---|---|---|---|
| Jedi (student) | Emma, later more students | Opens the site on her iPad, no login | Own username and password, stays signed in. Sees only her own work |
| Yoda (coach) | Sofia | Same page as Emma, plus a key that unlocks the proof board | Own login with two-factor. Home screen is the proof board for every student |
| Parent | Annat, later other parents | Gets the special proof link | Own login, read-only, only their own child |
| Automations | Claude scheduled tasks (RSM daily, Schoology and Pearson on request) | Use the same Google link as everyone | Their own protected key, tied to one student |

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

### Colors (how necessary it is to do that day)
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
- Same look as today: kawaii, same colors, fonts, squishy drawings and celebration

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
2. Supabase database and the who-sees-what rules
3. Logins and roles, plus a Yoda screen where Sofia creates accounts
4. Days checklist in Expo
5. Start, egg, proof and photos
6. Calendar, Plans and the bring-home list
7. Rewards: coins, mystery box, Shelf and Shop
8. Helper chat
9. Move the data from the Google Sheet and the photos from Drive
10. Notifications: the bell inbox, then push to phones
11. Proof board for Sofia and parents
12. Integrations: the protected pull endpoint and verified-by-platform
13. Website on a Netlify preview link, tested with a fake student and a fake parent, then a full security review
14. Switch Emma: sign her in on her iPad, give Annat her own login, shut off the old Google link and shared key, make the repo private, point the RSM task at the new version
15. App Store: Apple Developer Program, TestFlight, privacy policy, unlisted request
16. The edit backlog

## 9. Costs, open questions and sources

| Thing | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99 a year | Only needed once you're ready to test on the iPad. The app disappears if it lapses |
| Supabase | Free, then $25 a month | Free projects pause after 7 days with no activity (daily use keeps it awake) and have no backups. Upgrade once there's a second student |
| Netlify | Free | Website hosting |
| Expo | Free to start | The free plan gives a few cloud builds a month, in a slower line |
| Anthropic API | Pay as you go | Helper chat only |
| Custom web address | About $12 a year | Optional |
| Text or email alerts (later) | Email is nearly free; text costs a little per message and needs carrier registration | Not for launch |

Year one minimum is about $99 plus Helper chat usage.

### Open questions
1. What's Emma's username, and who keeps her password: Sofia or Annat?
2. Helper chat at launch: Sofia only, or on for Emma once Annat agrees?
3. Which reminders should Emma get on her own device, if any?
4. Should parents get a daily summary, or only "day cleared" alerts?
5. App name and icon for the App Store. Keep "Emma's Homework," or a name that fits more students?
6. Free netlify.app web address, or a custom one?

### Sources
- Claude Code in the cloud: quickstart
- Apple: Unlisted app distribution
- Apple: Developer Program fee waiver page (lists the $99 fee)
- Apple: guideline update on kids' apps and third-party data
- Expo: Submit to the App Store with EAS
- Expo: App Store submission without a Mac
- Supabase: Do projects pause when inactive?
- Supabase: free tier limits 2026

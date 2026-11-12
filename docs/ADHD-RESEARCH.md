# ADHD research behind the design

Written Nov 12, 2026. This is a quick literature scan done for product design, not a systematic review and not clinical advice. One source (the CHOP handout) was read in full. The others were read only as search excerpts, so each finding is marked with how much weight it can bear. A clinician (Emma's psychiatrist or therapist) should review this file and PRD section 1a before the design is treated as settled.

## How to read the confidence labels
- **Strong:** replicated or multiple trials or meta-analyses, and the source says so.
- **Moderate:** a review or several studies, but I only saw excerpts, or the results are mixed.
- **Weak:** plausible and widely used, but unproven or one small study.
- **Hypothesis:** a recent proposal, not settled.

## Findings and what they mean for the app

### 1. Executive function is the core problem for getting work done (Strong)
Meta-analyses find ADHD is associated with difficulties in working memory, response inhibition, reaction-time variability, and planning and organization (World Psychiatry review, 2025). Organization, time management and planning are the parts of executive function most tied to children's grades (Langberg et al., 2013, via the CHOP handout).
- App meaning: do not rely on her remembering, estimating time, or planning ahead. The app holds the memory, shows time, and breaks work down.

### 2. Teaching skills works, and it needs an adult (Strong)
Organizational Skills Training (OST) was tested in randomized trials for grades 3 to 5. It improved organization skills, homework performance and grades, reduced parent-child conflict, and the gains lasted into the next school year as rated by teachers who were not part of the program. HOPS (grades 6 to 8) and STAND (ages 11 to 15) also worked. All the tested programs are behavioral skills training with adult-provided support (CHOP handout, read in full).
- The four skill areas in OST: tracking assignments (a daily assignment record, a test and assignment calendar), materials management (a backpack checklist, "Ready-to-Go"), time management ("Time Detective", planning homework time), and planning short and long projects.
- Method: teach the skill, practice it with support, have adults reinforce it, tailor the system to the child, and plan how to keep it going after the program ends.
- Framing: OST presents the difficulties as mischievous "glitches" the child can beat as a team, not as a flaw in the child.
- App meaning: the app should teach and prompt these skills, not only list tasks. Emma is 10 (about grade 4 or 5), inside OST's tested range. The weekly planning with Sofia already matches OST's "planning conference". The app supports the adults, it does not replace them.

### 3. Rewards work best when immediate, real and tied to behavior, and need a plan for fading (Strong for the principle, Moderate for details)
- Children with ADHD choose small immediate rewards over larger delayed ones more often than other children, with small to medium effect sizes in a meta-analysis (PubMed 29806533). The same paper suggests hypothetical rewards are demotivating for participants with ADHD.
- Delay aversion is a continuum. Some individuals with ADHD show the opposite of steep discounting (Translational Psychiatry, 2025). So reward timing should not be assumed to be the same for every child.
- HOPS uses a point system that gives feedback at the moment of the behavior, and points are traded for rewards. It rewards using the skills (recording homework, packing, planning), not only results. Over time, natural rewards (parent praise, better grades) take over, and the system transfers to the parents (CHOP handout).
- App meaning: give feedback at the moment of starting and finishing. Reward skill use (starting, writing it down, packing the bag), not just completed work. Make long-delay prizes visible with nearer steps. Build in a way to fade the artificial rewards.

### 4. Game-style engagement helps at first, but long-term evidence is thin and novelty can wear off (Moderate)
- A review of video-game-based treatments reports high adherence (about 14 percent average drop-out) in exergaming, but I did not read its long-term results (ResearchGate 374156144, excerpt only).
- A systematic review on gamification in digital mental health describes an "engagement-efficacy-ethics trilemma" and notes that over-reliance on extrinsic motivators may lead to user fatigue (ResearchGate 400553920, excerpt only).
- I could not load the PubMed page for the 2025 serious games review, so I have not read its conclusions.
- App meaning: Sofia's stated goal is only "Emma uses it for the first month". That is realistic for a novelty-driven reward system. The risk is month two or three. Plan for refreshing rewards (already in the backlog), reward skills instead of only prizes, and measure use over time instead of assuming it holds.

### 5. ADHD varies a lot between people, and within the same person day to day (Strong for variation between people, Moderate for within-person)
- Three presentations are recognized: combined, predominantly inattentive, predominantly hyperactive-impulsive. Hyperactivity tends to decrease with age, so inattentive presentation is most common in older teens and adults (World Psychiatry review).
- Girls and women are reported to show more inattentive symptoms, fewer hyperactive ones, and more emotional difficulties, so their ADHD is less visible to others (item-level review, 2025). Emma is a girl, so do not assume visible hyperactivity.
- Performance varies within one person with tiredness and context. One 2026 paper proposes an energy-dysregulation model to explain this (Hypothesis). The within-person variability itself is widely reported.
- App meaning: no one-size defaults. Capture how it shows up for each student (PRD 6e). Plan with slack. Allow hard-day adjustments.

### 6. Emotional regulation difficulties are common and connected to executive function (Moderate)
- Emotion dysregulation is associated with ADHD symptom severity and with executive function. In children with ADHD, lower executive function was associated with more emotion dysregulation, though the effect was small in one study (a few percent of the variation) (systematic review, 2026; World Psychiatry review).
- Note on "rejection sensitivity": it is widely discussed online, but I did not find it as an established diagnosis in what I read, so the PRD uses "emotional dysregulation" and "feeling criticized" in plain terms.
- App meaning: tone matters. No shaming, no scolding, no loss mechanics that can feel like punishment, and no pressure countdowns. Language like "glitch to beat", never "lazy".

### 7. Body doubling is popular but unproven (Weak)
- A coaching organization that popularized the term says plainly there is no research proving its effectiveness (ADDA article). A secondary source describes one small brain-computer-interface study that found no significant effect on performance, focus or completion time, and says body doubling does not work for everyone and may signal a larger problem if needed for every task.
- App meaning: Start with "Sofia can see you're working" is a mild version. Treat any "presence" feature as an experiment, measure it, and do not promise it works.

### 8. Working memory is the sharpest weakness to design around (Strong)
Large deficits in the central executive part of working memory are reported in school-age children with ADHD (PubMed 39291373, excerpt).
- App meaning: one instruction at a time, written cues, short lists, no multi-step instructions held in her head.

## How today's design lines up

| Today | Evidence says | Decision needed |
|---|---|---|
| Checklist, Start button, proof | Good: external memory, a clear start, immediate feedback | Keep |
| Coins on check-off with animation | Good: immediate feedback | Keep |
| Weekly planning with Sofia | Matches OST's planning conference | Keep, and let the app prepare it |
| Rewards only for finishing | HOPS also rewards skill use | Add rewards for starting, writing down, packing |
| Real weekly squishy | Real rewards matter, but a week is a long delay | Keep, add nearer milestones |
| Days tab can show 7 days | Too many items can overwhelm | Default to today or a single "next" card |
| Sofia sees live "working" and unchecks | Fine as support, but can feel like surveillance | Tell Emma what is shared and why |
| Full box needs half the work, sparkle needs 3 full days in a row | Streaks and thresholds can feel like loss after a miss | Review with a clinician, add a hard-day mode |
| Random rarity in mystery boxes | Variable rewards can hook impulsive kids | Keep earned-by-effort only, no real-money purchases, review |
| Toast with "Get ready for her call at 10pm" | Pressure message | Replace |
| One fixed look and prompting style | ADHD varies by person | Per-student profile (PRD 6e) |

## What I could not establish
- Whether a particular reward schedule (fixed or surprise) works better for a given child. The evidence I saw says it varies, which is why how feedback and nearer milestones are presented is a per-student setting that should be measured. The coin amounts and prices themselves stay the same for everyone.
- Whether apps like this improve grades. The tested interventions are skills programs with adults, not apps. The app is a support for that approach, and the PRD should not claim more.
- Long-term effects of gamified systems. Evidence was thin in what I read.

## Sources
- Organizational skills training, HOPS, STAND: https://www.chop.edu/sites/default/files/adhd-exec-8-research-based-interventions-for-otmp-child-focused.pdf (read in full)
- ADHD in adults, evidence base and controversies (World Psychiatry): https://onlinelibrary.wiley.com/doi/10.1002/wps.21374 (excerpt)
- ADHD and choice of small immediate over larger delayed rewards, meta-analysis: https://pubmed.ncbi.nlm.nih.gov/29806533/ (excerpt)
- Delay aversion profiles in ADHD: https://www.nature.com/articles/s41398-025-03353-z (excerpt)
- Presentation of ADHD in females, item-level review: https://www.sciencedirect.com/science/article/pii/S0149763425000648 (excerpt)
- Executive function and emotion regulation in autism and ADHD: https://www.sciencedirect.com/science/article/pii/S0149763426000254 (excerpt)
- Energy dysregulation model of ADHD (hypothesis): https://www.sciencedirect.com/science/article/pii/S0149763426000710 (excerpt)
- Working memory deficits in school-age children with ADHD: https://pubmed.ncbi.nlm.nih.gov/39291373/ (excerpt)
- Body doubling, ADDA: https://add.org/the-body-double/ (read as a search result)
- Body doubling, guide citing a study: https://www.refreshpsychiatry.com/post/body-doubling-adhd (secondary source)
- Serious games as digital therapeutics for ADHD: https://pubmed.ncbi.nlm.nih.gov/40327858/ (page did not load, not read)
- Adherence in video-game-based ADHD treatments: https://www.researchgate.net/publication/374156144 (excerpt)
- Gamification trilemma in digital mental health: https://www.researchgate.net/publication/400553920 (excerpt)

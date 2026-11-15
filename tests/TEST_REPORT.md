# Test report: Bring Your Batch Growth Engine

Run at 2026-10-27T16:53:32.377Z with `node tests/run-tests.js` (Playwright, headless Chromium).

**Result: 32 of 32 checks passed.** These are the real outputs of that run.

**Note on an earlier false pass:** the test page used to lack the rule that hides elements marked `hidden`. Because of that, the duplicate check counted a notice as visible when it wasn't, and the real bug went unnoticed: a phone typed as "+91 98765 43210" was cut off by the input's length limit. Both are fixed, and every check now runs with that rule in place.

## What this run covers, and what it does not

- The page ran **outside claude.ai**, so the shared database and AI were not available. The run tested **sandbox mode** (browser storage) and the **no AI fallbacks**.
- **Shared database:** the published artifact's database was read separately. Its `registrations` and `projects` collections answered. Live writes from a signed in viewer were not run by the test.
- **Live AI:** AI scoring and the AI message rewrite were not run by the test. Evidence that live AI works comes from a real Project Judge record saved by the owner on 27 Oct 2026 (an earlier version, scored by AI with 78/100).
- **No build step:** the app is one static HTML file. "Build" means the script parses with `node --check` and the page loads with no runtime errors.

## Results

| # | Check | Result | Detail from the run |
|---|---|---|---|
| 2 | Invalid input is rejected | PASS | name error shown: true, phone error shown: true, records: 0 |
| 2b | Unknown referral code is rejected | PASS | ref error shown: true |
| 1 | A new student can register | PASS | ticket visible: true, records: 1, code: SAIMCFK |
| 5 | Acquisition source is recorded | PASS | heard=club, source=club |
| P1 | Phone number is not stored | PASS | dk=15ed4f7415e87efc |
| 9 | Share message contains the correct referral link | PASS | Register with my link: https://claude.ai/artifact/SYppRWAxDLN6MWfmGEWiQi#r-SAIMCFK |
| 3 | Duplicate registration is refused and not counted | PASS | duplicate notice: true, records still: 1 |
| 4 | Referral code is captured from the link | PASS | prefilled=SAIMCFK, ref=SAIMCFK, source=referral |
| 4b | Referrer's hall ticket count updates | PASS | Your codeSAIMCFK1 joined with it |
| 6 | One person counts once even if submitted again | PASS | records after repeat: 2 |
| 6b | No-code signup uses the self reported source | PASS | source=social |
| 7 | Leaderboard matches the records | PASS | college sum 3 vs records 3; top referrer count 1 |
| 8 | Dashboard agrees with the records | PASS | KPI 3, sources sum 3, referral KPI 1, records 3 |
| 8b | Synthetic view: sources add up to the unique total and are labelled | PASS | total 528, sources 528, label "Synthetic demo · 525 of 528" |
| 8c | Each recommendation shows its metric and threshold | PASS | 7 rules rendered with metric + threshold |
| A1 | Ambassador kit works and keeps the link; AI languages disabled without AI | PASS | activated: true, link in message: true, AI option disabled: true |
| A2 | Messages with synthetic numbers carry a do-not-send warning | PASS | warning shown on Day 5 in synthetic view: true |
| 11 | Missing AI does not crash; demo mode is used | PASS | mode chip "Demo mode: rule based, no AI in this view", score 80, page errors 0 |
| 12 | Judge output is labelled with its mode and evidence limits | PASS | criterion points 17+16+17+17+13 = 80 vs total 80 |
| 12b | Resume line claims only completed work | PASS | no live link given, so the line says Built, not Built and deployed |
| 13 | Demo certificate is not presented as official | PASS | verify: YesID exists in this prototypeYesBelongs to: Sai A. · SRM Univ. AP · “Resume Reviewer for ECE Core Roles” · Built 80/100YesIs a demonstration artifactNoOfficial |
| E1 | Experiment link tags the signup with its arm | PASS | exp=t1a, ref=SAIMCFK, t2=a |
| E2 | Experiments panel counts real arm signups | PASS | Test 1 · Invite vs posterA personal message from a classmate gets more signups than a forwarded poster.Arm and linkGroup sizeSignupsPer 100  |
| E3 | CSV import dedupes, rejects bad rows and keeps attribution | PASS | imported 2 of 4 rows; sources ambassador,ambassador |
| E4 | Imported records join the unique total | PASS | KPI 6 = 4 app + 2 imported |
| A3 | Tone option changes the message and keeps the link | PASS | friendly 394 chars, short 94 chars |
| W1 | What if planner reproduces the plan and reacts to assumptions | PASS | Modelled unique registrations500Reaches 500 Ambassadors 299R → at 3%: Modelled unique registrations362138 short of 500 Ambassadors |
| W2 | Show up plan computes expected attendees and lists reminders | PASS | Expected attendees26 registered × 35%. Replies of ; 4 reminders |
| W3 | Guided tour walks all 6 steps and closes | PASS | 1 of 6, 2 of 6, 3 of 6, 4 of 6, 5 of 6, 6 of 6; closed: true |
| 10 | Works on a 375px wide phone screen (no sideways scroll) | PASS | all 5 tabs fit 375px |
| 14 | No secrets in client code | PASS | no key patterns found |
| 15 | Build: script parses and the page loads without errors | PASS | node --check: ok; runtime page errors: none |

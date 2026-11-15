# Bring Your Batch Growth Engine

A working prototype for the NxtWave Growth Intern challenge, built by Sai Meghana Annepu: get 500 final year engineering students to register for a simulated free workshop, “Build Your First AI Project in 60 Minutes”, in 7 days, with ₹2,000.

This is not an official NxtWave page. Nothing it collects is sent to NxtWave, and no messages are sent to anyone.

**Live prototype:** https://claude.ai/artifact/SYppRWAxDLN6MWfmGEWiQi (private until the owner shares it from the page's Share menu).

## The five tabs

| Tab | What it does |
|---|---|
| Register | Mobile first landing page and a five question form. Validates input, refuses duplicates by phone fingerprint, records the first touch source and the referral code, then shows a hall ticket with a personal code and a WhatsApp share link. |
| Leaderboard | College ranking, ambassador ranking, student referrer ranking, a small South vs North side race, and an explanation of how ranks are counted. |
| Ambassador HQ | A personal link plus a message for each campaign day (announcement, community forward, reminder, referral ask). Has audience options and a Telugu English or Hindi English AI rewrite that is checked against the template. |
| Growth Dashboard | Unique total, progress and gap, source vs plan, referral attribution, active ambassadors, budget committed vs spent, cost per signup, a forecast range, and 7 fixed rules showing their metric, threshold and action. |
| Extras on the dashboard | A **what if planner** (sliders for every planning assumption; shows whether 500 is reachable, the signup rate needed, and which assumption matters most) and a **show up plan** (expected attendees under an assumed rate, plus reminders for 24 h before, 1 h before, start time and the day after). A **How it works** button runs a 6 step guided tour. |
| Project Judge | Secondary to registrations. Weighted rubric feedback (20/25/20/20/15), a resume line limited to completed work, a draft LinkedIn post, and a demo certificate with a verification check. |

## Running the three tests

Growth Dashboard → Experiments.

- **Test 1 (invite vs poster) and Test 3 (any branch framing):** each arm has its own link (`#x-t1a-CODE` and so on) and a ready message. Signups that arrive through a link are tagged with that arm. For Test 1, enter each group's member count to get signups per 100 members.
- **Test 2 (rank line on the hall ticket):** each registrant is placed in arm A or B by their phone fingerprint. Arm B's hall ticket and share message leave out the college rank. Share rate = the % of registrants whose code brought at least one signup.
- **Verdicts:** a two proportion z test. The app won't read a result below 20 signups per arm (30 for Test 2).
- **Collecting real signups:** students outside your claude.ai organization can view the page but can't save to its database. For a real run, collect signups with a Google Form, with a hidden or prefilled Variant field holding t1a, t1b, t3a or t3b. Then use **Import Google Form CSV**. The import dedupes by phone, drops bad rows, applies the same attribution rules and stores no phone numbers. Use **CSV template** for the column names.

## Definitions

- **Unique registration:** one record per phone fingerprint. The record id is the fingerprint, so a phone number can only exist once.
- **Duplicate registration:** an attempt with a fingerprint that already exists. It is refused, the student sees “already registered”, and nothing is stored.
- **Acquisition source:** exactly one per registration, so sources add up to the total. An ambassador's code means Ambassador, a student's code means Referral, and with no code the student's own answer decides.
- **Referral attribution:** a registration that used any valid code; credit goes to the code owner. Self referral is blocked.
- **Active ambassador:** an ambassador whose code brought at least one registration.
- **Qualified registration:** not used in the prototype.

## How to run it

It is one HTML file with no build step and no dependencies to install.

- **On claude.ai (recommended):** open the live link. Signed in viewers with edit access share one database; everyone else gets sandbox mode.
- **Locally:** wrap `index.html` in a basic HTML document and open it in a browser. It runs in sandbox mode with no AI.

## Data, demo mode and environment

- **Shared data:** the claude.ai artifact database (`registrations`, `projects`). No server or keys of your own are needed.
- **Sandbox mode:** if the database isn't available or the viewer can't write, entries are kept in that browser's local storage. The top bar says which mode is active.
- **Synthetic demo data:** a seeded generator creates a 7 day run inside the page; it is never written to the database. Turn it off with “Real entries only”, and replay any day with the slider. “Remove my test entries” deletes what this browser added.
- **AI:** uses the viewer's own claude.ai access through the artifact's `sample` capability. There are no API keys in the code. Without AI, the Judge uses a labelled rule based demo mode capped at 85% per criterion, and the AI languages in Ambassador HQ are disabled.
- **Environment variables:** none needed. A production version would keep the database and model credentials on a server.

## Privacy and honesty choices

- The phone number is never stored, only a 16 character SHA-256 fingerprint. *Limitation:* Indian mobile numbers are a small space, so a determined person could brute force a fingerprint. A production system would check duplicates on a server and never expose the fingerprints.
- Public views show first name plus last initial, college and branch. No contact details.
- Every synthetic number is labelled. Ambassador messages built from synthetic counts show a do not send warning.
- All rewards are labelled proposed and conditional on results. There are no seat limits, guarantees or official endorsements.
- Demo certificates say “Demonstration · not officially issued” on the image and carry a DEMO watermark. The verifier states they were not issued by NxtWave or any organization, and they don't claim attendance.
- The Judge reads only what the student types. It never opens links or runs code, and every result says so.

## Tests

`node tests/run-tests.js` (needs Node and Playwright). The latest results are in `tests/TEST_REPORT.md`.

## Known limitations

- Link visits aren't tracked, so the conversion rule shows “not enough data”.
- Two people registering with the same phone at the same moment could race. Last write wins on the same record id, so the count still can't double.
- The database holds up to 25,000 documents, which is far above this campaign's needs.
- Old test records from version 1 (one registration, two projects) remain in the shared database. Version 2 ignores them, and they can be deleted on request.

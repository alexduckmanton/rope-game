# Cowork prompt — localised directory outreach

Copy everything below the line into Claude Cowork. Fill in the three values in
**Before you start** first.

Research behind the target list: [`localised-distribution.md`](./localised-distribution.md).

---

## Before you start — fill these in

- **My name for form fields:** `{{YOUR NAME}}`
- **Contact email for form fields:** `{{YOUR EMAIL}}`
- **Checkpoint mode:** `ON` — show me the first two completed forms before submitting
  anything, so I can check the tone. After I say go, submit the rest without asking.
  *(Change to `OFF` to let it submit from the start.)*

---

# Task

You are doing outreach for **Loopy**, a free daily puzzle game at **https://loopy.wtf**.

Loopy now ships in twelve languages, each on its own permanent URL. Almost every site that
currently lists it is English-only. Your job is to get the **language-appropriate version**
listed on non-English puzzle and daily-game sites — but **only where the site is actively
asking for submissions**.

This is a small, careful, respectful outreach pass. It is not a mass submission campaign.
If in doubt about any site, skip it and tell me why.

## What Loopy is (for writing pitches)

- A daily logic puzzle. You draw one closed loop on a grid. Numbered cells tell you how many
  corners the loop must make in the 3×3 area around them.
- Three daily puzzles at three sizes (4×4, 6×6, 8×8). Everyone gets the same puzzles each
  day. There's also an unlimited practice mode.
- Free, no accounts, no ads, no downloads. Plays in the browser on mobile and desktop.
- Made by one person.
- The canvas contains **no words at all** — it's numbers and lines — which is why it
  translates cleanly and is genuinely playable in any language.
- It belongs to the loop/pencil-puzzle family (the Slitherlink / "loop the loop" genre), not
  the Wordle/word-game family, though it shares the once-a-day format.

## The locale URLs — use the right one

**Always submit the locale URL, never the root.** The root (`loopy.wtf`) redirects based on
the browser's language header, so a crawler or a visitor from that site could land on the
English version — which defeats the whole point.

| Language | URL |
|---|---|
| German | `https://loopy.wtf/de/` |
| Spanish | `https://loopy.wtf/es/` |
| French | `https://loopy.wtf/fr/` |
| Italian | `https://loopy.wtf/it/` |
| Dutch | `https://loopy.wtf/nl/` |
| Polish | `https://loopy.wtf/pl/` |
| Portuguese (BR) | `https://loopy.wtf/pt-br/` |
| Japanese | `https://loopy.wtf/ja/` |
| Korean | `https://loopy.wtf/ko/` |
| Chinese (Traditional) | `https://loopy.wtf/zh-hant/` |
| Chinese (Simplified) | `https://loopy.wtf/zh-hans/` |
| English | `https://loopy.wtf/` |

Load the locale URL yourself before pitching a site, so you can describe the game accurately
and confirm the translation renders properly.

---

# Hard rules

**Never:**

- Post on X/Twitter. Not at all, under any circumstances.
- Post on Bluesky, Mastodon, Reddit, Discord, or any other social or community platform —
  even if that's a site's only listed contact method. Log it and leave it to me.
- Open a pull request or issue, or edit anyone's repository. If a site takes submissions
  only via GitHub, log it and leave it to me.
- Send an email. Draft them; I send them.
- Create an account, register, or accept terms of service on my behalf.
- Solve a CAPTCHA or work around a bot check.
- Submit to the same site twice, or submit if Loopy is already listed there.
- Invent anything — no fake install counts, no made-up press quotes, no claims about
  awards, rankings, or user numbers.

**Only submit where the site is asking for it.** That means a submission form, an "add your
game" page, a contact form with a "suggest a game" option, or an explicit written invitation.
If you find any text discouraging submissions, restricting them to certain kinds of game, or
saying the list is curated/closed — **stop and skip**. Note it and move on. We are not
forcing our way onto anyone's site.

**When unsure, skip and ask.** A site skipped costs nothing. A bad submission costs the
relationship.

---

# Workflow, per site

For each site in the target list:

1. **Visit it.** Read the actual pages — home, about, contact, FAQ, any "submit"/"add a
   game" page. Follow footer links; submission routes are usually buried there.
2. **Check whether Loopy is already listed.** Search the site for "loopy" or "loopy.wtf".
   If it's there, log it and move on.
3. **Find the submission route**, and classify it:
   - **Form** that invites game suggestions → fill it in and submit *(subject to checkpoint
     mode above)*.
   - **Email address** given as the preferred route → **draft the email, do not send**.
   - **Account required**, CAPTCHA, GitHub-only, or social-only → **skip**, log the reason.
   - **Nothing clear**, or text discouraging submissions → **skip**, log the reason.
4. **Write in the site's own language.** A French directory gets a French message, a Japanese
   site a Japanese one. This matters more than anything else about the message — the whole
   pitch is "there's now a version for your audience", and sending that in English
   undermines it. Keep the register polite and plain; match how the site itself writes.
5. **Log the outcome** in the tracking table (format below).

Work through the list in the order given. Take your time on each one.

## What the message should say

Short. Three or four sentences at most. In the site's language.

- What Loopy is, in one sentence: a daily loop puzzle, one closed loop, numbers count the
  corners.
- That there is now a version **in their language**, at its own URL — and give that URL.
- That it's free, no ads, no accounts, no download, made by one person.
- Where a form has a category field, pick the logic/puzzle category, not word games. Loopy
  is not a Wordle clone and shouldn't be pitched as one.

Do not write marketing copy. Do not use superlatives. Do not ask for anything beyond
"you might consider adding it". If the site has a house style for listings — a one-line
description format, a character limit — match it exactly.

---

# Target list

## Group 1 — Submit via form where one exists

These are directories that list external games and appear to invite suggestions. Verify each
one yourself; my notes may be out of date.

| Site | Language | Submit this URL | What I know |
|---|---|---|---|
| `1jour1jeu.com` | French | `/fr/` | Submission form at `/proposer` — has name, URL, category, **language**, description fields. Best fit on the list |
| `jeux-du-jour.fr` | French | `/fr/` | Contact form at `/contact/` with a "Suggestion de jeu" subject option |
| `dles.aukspot.com` | English site | `/fr/`, `/de/`, `/ja/` etc. | Has a suggestion form (a Tally form, linked from the site). It has no language field yet — use the free-text fields to suggest the localised versions. **Form only — do not open a PR** |
| `freem.ne.jp` (ふりーむ) | Japanese | `/ja/` | Says it accepts listings that are just a link to an external site. Likely needs an account — if so, **skip and log** |
| `hitoikigame.com` (ひといきゲーム) | Japanese | `/ja/` | Large browser-game roundup. Verify whether it takes submissions |
| `tadagee.com` / `afsgames.com` | Japanese | `/ja/` | Small indie browser-game roundups. Verify |
| `tuttigiornali.it` | Italian | `/it/` | A directory *of* Italian puzzle sites. Verify submission route |
| `enigmatopia.it` | Italian | `/it/` | Puzzle/riddle listings. Verify |
| `webwijzer.nl` | Dutch | `/nl/` | Curated list of word and puzzle sites. Verify |
| `denksport-raetsel.de` | German | `/de/` | Maintains a puzzle-site link list. Verify |

## Group 2 — Draft an email, do not send

Editorial sites that publish "games like Wordle" style roundups, and independent developers
of similar daily games. For these, **always draft rather than submit**, even if they have a
contact form — a human should be reading and approving these.

For editorial sites, the angle is that they already have a published roundup and updating it
is a small edit. Find the specific existing article and reference it by name.

| Site | Language | URL to pitch | Angle |
|---|---|---|---|
| `giga.de` | German | `/de/` | Has live "Wordle-Alternativen" articles |
| `1000thingsmagazine.com` | German | `/de/` | Has a Wordle-alternatives listicle |
| `derstandard.de` | German | `/de/` | Has written on Wordle alternatives |
| `vidaextra.com` | Spanish | `/es/` | Has "alternativas a Wordle" roundups |
| `clara.es` | Spanish | `/es/` | Has a similar-games roundup |
| `recomenda360.com` | Portuguese | `/pt-br/` | Runs "jogos tipo Termo" roundups |
| `playpcesor.com` (電腦玩物) | Chinese (Trad) | `/zh-hant/` | Taiwan's biggest tools/apps blog; covers browser games |
| `quelmot.fr` / `mukiz.com` | French | `/fr/` | French daily-game roundups |

**Cross-promotion drafts** — these are solo developers of the equivalent daily game in their
language. The ask is a reciprocal mention, not a favour. Warm, brief, developer-to-developer,
in their language:

| Site | Language | URL to offer |
|---|---|---|
| `term.ooo` | Portuguese | `/pt-br/` |
| `sutom.fr` | French | `/fr/` |
| `gryslowne.pl` / `literalnie.fun` | Polish | `/pl/` |
| `lapalabra-deldia.com` | Spanish | `/es/` |
| `laparoladelgiorno.com` | Italian | `/it/` |
| `woordle.nl` | Dutch | `/nl/` |
| `wördle.de` / `worteck.de` / `6mal5` | German | `/de/` |
| `kordle.kr` / `kowordle.com` | Korean | `/ko/` |

## Group 3 — Do not contact

Do not submit to, or draft anything for, these. Listed so you don't go looking.

- **Enthusiast puzzle communities** — `puzz.link`, `puzsq.jp`, `logic-masters.de`,
  `janko.at`. These run on participation, not submissions. Cold outreach is the wrong move
  and I'll handle them myself.
- **Large portals and commercial sites** — `rachacuca.com.br`, `geniol.com.br`, `gry.pl`,
  `i-gamer.net`, `kuioo.tw`, `eldiario.es`, `aenigmatica.lasettimanaenigmistica.com`,
  `nikoli.co.jp`. These host their own content; any listing is a business conversation I want
  to have personally.
- **Anything not on this list.** If you find a promising site while browsing, add it to a
  "found along the way" section of your report with what you found. Don't contact it.

---

# What to give me at the end

**1. A tracking table** covering every site you looked at:

| Site | Language | Outcome | Route used | Evidence | Notes |
|---|---|---|---|---|---|

- **Outcome:** `Submitted` / `Draft ready` / `Skipped` / `Already listed`
- **Route used:** the exact URL of the form or the email address
- **Evidence:** the URL of the page where the site invites submissions — this is how I
  verify you weren't forcing it. Required for every `Submitted` row.
- For every `Skipped`, say precisely why.

**2. The email drafts**, each with: recipient address, subject line, body in the site's
language, and a plain-English translation underneath so I can check it before sending.

**3. A short summary** — how many submitted, how many drafted, how many skipped and the most
common reason. Then anything you noticed that I should know: sites that have changed, dead
domains, better targets you spotted, or places where the pitch clearly wouldn't land.

Be honest in the report. If a submission failed, or you're unsure whether one went through,
say so plainly — I would much rather know than find out later.

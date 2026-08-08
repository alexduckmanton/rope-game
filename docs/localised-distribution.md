# Loopy — Non-English Distribution Targets

Companion to §6.1 of `growth-strategy.md`, which lists the English directories. This one
covers the eleven localised builds. Researched August 2026.

---

## 1. What the referral data actually says

Before picking targets, look at what already works. Last 180 days, by initial referring
domain:

| Referrer | Visitors | What it is |
|---|---|---|
| `dles.aukspot.com` | 91 | Open-source directory, 700+ daily games |
| *(direct)* | 40 | — |
| `www.goldles.com` | 11 | "-dle" directory |
| `www.alldle.net` | 3 | "-dle" directory |
| `github.com` | 2 | — |
| `adoryvo.github.io` | 2 | Creator-maintained dailies list |
| `dle.games` | 2 | "-dle" directory |
| `dles.gg` | 2 | "-dle" directory |
| `dailygameindex.com` | 1 | "-dle" directory |
| `www.reddit.com` | 1 | — |

Two conclusions, and they point in different directions.

**The format is proven.** Essentially every referred visitor came from a daily-game
directory. Not a web-game portal, not a puzzle magazine, not social. One directory alone
supplies 58% of referred sessions. So the non-English question is a narrow one: *where are
the localised equivalents of `dles.aukspot.com`?*

**The scale is not.** That entire channel is ~112 visitors in six months. This is a
backlink and indexation play whose value compounds through the `hreflang` cluster, not a
traffic event. Budget effort accordingly — an afternoon per language, not a campaign.

Current audience by country (90 days) already shows unprompted demand in target markets:
US 45%, AU 11%, GB 10%, CA 7%, **BR 4%, DE 2.6%, JP 2%, IT 2%, PL 2%**, NL/SE/FR ~1.3% each.
Brazil is the fifth-largest country with zero Portuguese marketing.

---

## 2. The single highest-leverage action

`dles.aukspot.com` — the referrer that already supplies most of Loopy's referred traffic —
**has no concept of language.** Confirmed from its schema: no language field, no filter, no
tags. Same for the other English directories.

It is open source: `github.com/aukspot/dles`, and it takes submissions three ways — a Tally
form, a "dle suggestion" issue, or a direct PR editing `dles.json`.

So: open a PR adding a `language` field, a filter UI, and the eleven localised Loopy URLs.
That is one action, against the directory that demonstrably converts best, that puts every
language build in front of the exact audience that already responds to it — and it makes
the directory better for every other non-English daily game, which is what gets a PR
merged. Do this before any of the outreach below.

**Always submit the locale URL** (`loopy.wtf/de/`, `loopy.wtf/ja/`, …), never the root. The
root language-detects and 302s; a directory's crawler sends no `Accept-Language` header and
would index the English version, which defeats the point of having separate URLs.

---

## 3. Targets by language

Three kinds of target, and the ask is different for each:

- **Directory** — lists external games with outbound links. Same model as the sites that
  already work. Submit and move on.
- **Community/portal** — hosts its own puzzles or licensed games. A "listing" means a
  partnership or an embed, not a link. Higher traffic, much higher effort.
- **Editorial** — blogs and magazines that publish "games like X" roundups. The ask is a
  short pitch to a writer, and updating an existing post is far easier for them than
  writing a new one.

Traffic is Similarweb, June 2026, converted from their three-month totals to a monthly
average. Sites below roughly 5K/month fall under Similarweb's reporting threshold and show
as "no data" — that absence is itself the estimate, and is marked *(sub-threshold)*.

### 3.1 French — do this first

The only market with a true localised daily-game directory, and there are two of them, both
with a **language field already in their submission form**. Highest return per hour on the
whole list.

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [1jour1jeu.com](https://1jour1jeu.com/) | Directory | *(sub-threshold)* | 144 games, 9 categories. Submission form at `/proposer`: name, URL, category (incl. "logique & maths"), **language**, description, email |
| [jeux-du-jour.fr](https://jeux-du-jour.fr/) | Directory | *(sub-threshold)* | 100+ FR daily games. Contact form has "Suggestion de jeu" *and* "Proposition de partenariat" subjects |
| [sutom.fr](https://sutom.fr/) | Cross-promo | ~25K | The French Wordle and anchor of the scene. Runs a `/news/` blog |
| [quelmot.fr](https://quelmot.fr/), [mukiz.com](https://mukiz.com/) | Editorial | small | Already publish FR daily-game roundups |

Both directories are small today. They are also new, growing, uncontested, and structurally
identical to the site supplying most of Loopy's referrals. Cheap bet.

### 3.2 Portuguese (Brazil) — where the audience is

Far and away the largest addressable market, and already Loopy's #5 country unprompted.

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [term.ooo](https://term.ooo/) | Cross-promo | **~933K** | The Brazilian Wordle. 3m20s sessions, 33% bounce. Solo dev (Fernando Serboncini) — a reciprocal link is a plausible ask |
| [rachacuca.com.br](https://rachacuca.com.br/) | Community | **~567K** | **#1 in Puzzles & Brainteasers, Brazil.** 8m01s sessions, 3.22 pages/visit. Hosts logic puzzles — the ask is partnership or embed |
| [geniol.com.br](https://www.geniol.com.br/) | Community | ~333K | #3 in category. 6m34s sessions. Same shape as Racha Cuca |
| [recomenda360.com](https://recomenda360.com/jogos/jogos-tipo-termo/) | Editorial | small | Runs "jogos tipo Termo" roundups |

The caveat: the two big ones host rather than link, so this is the highest-traffic and
highest-effort market simultaneously. Racha Cuca's engagement numbers (8 minutes, 3.2 pages)
are the best in this entire research set — these are real puzzle solvers, not portal
traffic.

### 3.3 Japanese — the best genre fit anywhere

Loopy is a loop puzzle. Japan invented the genre — Nikoli's Slitherlink — and has the
world's most serious pencil-puzzle community. Japan is already Loopy's #7 country.

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [freem.ne.jp](https://www.freem.ne.jp/) (ふりーむ) | Directory | ~157K | **Explicitly accepts link-only submissions** — 紹介の形で他サイトへのリンクだけでも投稿できます. The best structural fit in Japanese. Reviewed, not automatic |
| [hitoikigame.com](https://hitoikigame.com/) (ひといきゲーム) | Directory | ~105K | 10,000+ browser games, updated daily |
| [puzz.link](https://puzz.link/) | Community | ~55K | The pencil-puzzle community standard. 6.48 pages/visit, 6m20s, **+23.5% MoM**. JP 59% / US 27% |
| [nikoli.co.jp](https://www.nikoli.co.jp/) | Editorial | ~22K | The genre's institution. Long game, but the endorsement that would matter most |
| [puzsq.jp](https://puzsq.jp/) (Puzzle Square JP) | Community | *(sub-threshold)* | Self-described 日本最大のパズル投稿サイト, 60,000+ user-submitted puzzles |
| [tadagee.com](https://tadagee.com/), [afsgames.com](https://afsgames.com/), PLiCy, unityroom | Directory | small | Indie browser-game roundups, low effort |

Note that `puzz.link` and `puzsq.jp` are for *user-authored* puzzles, so the natural entry
is to participate — post puzzles — rather than to submit a link. Slower, but that community
is where puzzle enthusiasts who evangelise games actually live. The `ペンシルパズルWiki`
and `ペンシルパズル研究所` link collections are the cheap version of the same idea.

### 3.4 Traditional Chinese (Taiwan) — high traffic, low friction

Per the localisation notes, `zh-Hant` is the stronger of the two Chinese builds; mainland
China is largely unreachable from this deploy, so **deprioritise `zh-Hans` outreach entirely**.

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [i-gamer.net](https://www.i-gamer.net/) (遊戲天堂) | Portal | ~199K | TW 88%. 6.63 pages/visit, 7m02s |
| [playpcesor.com](https://www.playpcesor.com/) (電腦玩物) | Editorial | ~111K | TW 89%. Taiwan's biggest tools/apps blog, covers browser games and utilities regularly. **A single post here is the highest-leverage individual action in Chinese** |
| [kuioo.tw](https://kuioo.tw/) | Portal | ~84K | TW 93%. 4.54 pages/visit, 7m59s, #1 in its games category |
| [gameschool.cc](http://gameschool.cc/puzzle/) | Portal | small | Curated 益智 (brain game) section |

### 3.5 German — no directory exists; go via the puzzle community

The weakest directory infrastructure of the major European languages. There is no German
`jeux-du-jour.fr`. Routes are the genre community and existing listicles.

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [logic-masters.de](https://logic-masters.de/) | Community | ~155K | Logic Masters Deutschland e.V. **35,429 puzzles.** 8.36 pages/visit, 6m42s, 27% bounce — outstanding engagement. **Caveat:** audience is international (US 23%, TR 17%, UK 11%, NO 10%, CN 9%) with an English toggle — a genre play, not a German-market one |
| [janko.at](https://www.janko.at/Raetsel/) | Community | ~30K | DE 77% / CH 4% / AT 3%. 300+ puzzle types including several loop genres (Rundreise, Geradeweg, Linesweeper, Masyu). Maintains a link list |
| [giga.de](https://www.giga.de/), [1000thingsmagazine.com](https://www.1000thingsmagazine.com/), [derStandard](https://www.derstandard.de/) | Editorial | large | All have live "Wordle-Alternativen" roundups. Pitch an update, not a new post |
| [denksport-raetsel.de](https://www.denksport-raetsel.de/) | Directory | negligible | Has a "Linkliste mit vielen guten Rätsel-Seiten". Free, takes five minutes |
| wortsuche.eu, worteck.de, wördle.de, 6mal5 | Cross-promo | small | German daily word games |

`denkspiele.com` and `grylog.pl` turned up in searches but are effectively dead traffic
(global ranks 5.2M and 11.8M) — skip both.

### 3.6 Italian

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [aenigmatica.lasettimanaenigmistica.com](https://aenigmatica.lasettimanaenigmistica.com/) | Community | ~44K | La Settimana Enigmistica's online portal — the most authoritative puzzle brand in Italy. IT 99%, 7m55s sessions |
| [tuttigiornali.it](https://www.tuttigiornali.it/giochi-di-enigmistica-online/) | Directory | small | Literally a directory *of* Italian puzzle sites. Easy win |
| [enigmatopia.it](https://www.enigmatopia.it/), [freeonline.org](https://www.freeonline.org/giochi/enigmistica/) | Directory | small | Puzzle/riddle listings |
| laparoladelgiorno.com, paritle.com | Cross-promo | small | Italian daily word games |

### 3.7 Spanish — fragmented, editorial is the route

Large speaker base, no dominant directory, and the audience is split across Spain, Mexico,
Colombia, Argentina and Peru. Infrastructure is weaker than the market size suggests.

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [eldiario.es/juegos](https://www.eldiario.es/juegos/) | Portal | large | Major newspaper games section. Licensed content — hard to enter |
| [juegos-mentales.com](https://www.juegos-mentales.com/Diario) | Portal | ~14K | MX 24% / CO 15% / AR 14% / ES 14%. Already hosts a "Daily Loop"; same network as `denkspelletjes.nl` |
| [vidaextra.com](https://www.vidaextra.com/), [clara.es](https://www.clara.es/), AARP en español | Editorial | large | Existing "alternativas a Wordle" roundups — pitch updates |
| lapalabra-deldia.com | Cross-promo | ~6K | The Spanish Wordle |

### 3.8 Dutch

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [denkspelletjes.nl](https://www.denkspelletjes.nl/Dagelijks) | Portal | ~5.5K | BE 53% / NL 47%. **9.47 pages/visit** — the highest engagement in this whole set. Already runs a "Daily Loop" |
| [webwijzer.nl](https://www.webwijzer.nl/games/woordspellen.html) | Directory | small | Curated list of word/puzzle sites and apps |
| [elkspel.nl](https://www.elkspel.nl/dagelijkse-spelletjes) | Portal | small | Has a "Dagelijkse spelletjes" section |

Small market, minimal effort — do it opportunistically, not as a priority.

### 3.9 Polish

| Site | Type | Traffic/mo | Notes |
|---|---|---|---|
| [gry.pl](https://www.gry.pl/gry/logiczne) | Portal | **~600K** | PL 96%, 3.69 pages/visit. The dominant Polish portal (Azerion family). Needs an embed deal, not a link |
| [gryslowne.pl](https://gryslowne.pl/) | Cross-promo | ~34K | **+145% MoM.** Closest thing to a Polish daily-games hub, growing fast. Best PL partner |
| literalnie.fun | Cross-promo | small | The Polish Wordle |

### 3.10 Korean — structurally the weakest

No native daily-game directory exists. Search turned up only the Korean Wordles
(`kordle.kr`, `kkordle.kr`, `kowordle.com`), a small curation site (`cheheum.com`), and
international portals (Poki, CrazyGames) serving the market.

This confirms the note already in `CLAUDE.md`: Korea runs through Naver, which does not
support `hreflang`, and its ranking rewards Naver Blog/Café/Knowledge-iN activity that
website content cannot substitute for. **Do not expect directory links here.** The
outstanding actions are registering with Naver Search Advisor and submitting
`/ko/sitemap.xml` — a console task, not outreach — plus a Naver Blog presence if Korea is
ever worth an ongoing content commitment. Until then, `/ko/` is architecture without a
distribution channel.

---

## 4. Priority order

Ranked by expected return per hour, not by traffic.

1. **PR the `language` field into `github.com/aukspot/dles`** and list all 11 locale URLs.
   One action, best-converting directory, helps every other non-English daily game.
2. **French directories** — `1jour1jeu.com/proposer` and `jeux-du-jour.fr` contact form.
   Both have language fields. Twenty minutes total.
3. **`freem.ne.jp`** — the only large Japanese directory that accepts a link-only listing.
4. **Existing listicle updates** — GIGA, 1000things, derStandard (DE); VidaExtra, Clara
   (ES); recomenda360 (PT). Updating a live post is a small ask with a large reach.
5. **`playpcesor.com`** — one Taiwanese blog post, ~111K/mo, high topical fit.
6. **Cheap directory submissions** — `tuttigiornali.it`, `webwijzer.nl`,
   `denksport-raetsel.de`, `tadagee.com`, `hitoikigame.com`.
7. **Cross-promo emails to solo devs** — `term.ooo`, `sutom.fr`, `gryslowne.pl`,
   `literalnie.fun`, `lapalabra-deldia.com`. Per §6.4 of the growth doc this is the most
   underrated channel, and every one of these is a single person who will read the email.
8. **Puzzle communities, slowly** — `puzz.link`, `puzsq.jp`, `logic-masters.de`, `janko.at`.
   Participate for weeks before mentioning Loopy. Highest-quality users, slowest payoff.
9. **Portal/embed deals** — `rachacuca.com.br`, `gry.pl`, `i-gamer.net`. Biggest numbers,
   real commercial conversations. Only worth it once retention justifies the effort.
10. **Skip:** `zh-Hans` outreach (unreachable market), Korean directories (none exist),
    `denkspiele.com` / `grylog.pl` (dead traffic).

---

## 5. Method and caveats

- Traffic is Similarweb estimates, June 2026, divided from three-month totals to a monthly
  average. Similarweb is most accurate in the 5K–100K/month band and systematically
  underestimates small sites; anything marked *(sub-threshold)* is below its reporting
  floor, which in practice means under roughly 5K/month.
- Engagement figures (pages/visit, session duration, bounce) are more decision-useful than
  raw visits for this purpose. A directory with 5K high-intent puzzle solvers beats a portal
  with 200K bounce traffic — `denkspelletjes.nl` at 9.5 pages/visit is worth more per
  visitor than its ranking suggests.
- Site categorisation (directory / community / editorial) is from reading each site, and it
  is the field that actually determines whether outreach can succeed. Traffic alone will
  mislead here: the four biggest sites in this document cannot give Loopy a link at all.
- Nothing here has been contacted. This is a target list, not a status report.

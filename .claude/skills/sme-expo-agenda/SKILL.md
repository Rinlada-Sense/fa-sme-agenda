---
name: sme-expo-agenda
description: Build and maintain the "SME How to Scale Expo 2026" personal agenda builder, a single-file landing page (source/agenda-day1.html) where visitors drag sessions into a 2-day schedule and download it as an image, copy it as text, or export it to their calendar. Use this skill whenever the user mentions the FlowAccount expo agenda, Agenda Day 1/2, the session tray or dock, the download image or both-days image, the .ics calendar button, the Thai/English switch, the expo header (logo, date, tagline bar), or the agenda Google Sheet, even if they only describe a small visual tweak.
---

# SME Expo 2026 – personal agenda builder

A bilingual (English/Thai) landing page for **FlowAccount's SME How to Scale Expo 2026** (18–19 Dec 2026, Sasin School of Management). Visitors build their own schedule from fixed-time sessions, then save it as an image. There is **no backend**: everything lives in one self-contained HTML file.

- Source: `source/agenda-day1.html` (~290 KB; images are embedded as base64).
- Render test harness: `scripts/render-download.js` (see "Testing").
- Previously hosted as a Claude.ai artifact (`claude.ai/artifact/D8MWq6bq4btKfH1jcfuG5o`). In Claude Code just edit the file; there is no publish step.
- Agenda data source (not yet wired up): Google Sheet `1_aPPFCTuysdVxZhAN-80CrzA-rSOq6Vd7QhdVEHXRpQ`, "SME How to Scale Expo 2026 – Agenda editor".

## How to work on this file (read first)

1. **One file, no build.** HTML + CSS + vanilla JS in an IIFE. Keep it self-contained. No frameworks, no external requests except the Google Fonts `<link>` for **Prompt** (weights 400–800).
2. **Never print the file raw.** It contains ~140 KB of base64. Strip it first:
   `re.sub(r'base64,[A-Za-z0-9+/=]+','base64,…', text)`. Do not use `cut -c` on lines with Thai text (it splits multibyte characters).
3. **Edit pattern that worked:** a small Python script using `s.count(old)==1` assertions then `s.replace(old,new)`, followed by `node --check` on the extracted `<script>` body. Assertions catch stale anchors; most failed edits were anchors that had already changed.
4. **Syntax-checking is not enough.** `drawImage` is wrapped in `try/catch` inside `saveDays()`, so a thrown error just shows "Couldn't build the image". After any change to the image code, run the headless harness and look at the PNG.
5. **Assets are embedded:** `#logoImg` (logo, 62 KB), `#barImg` (tagline bar, 50 KB, transparent), `#starImg` (AI star, 8 KB), `#bgImg` + CSS var `--bg-art` (background, 20 KB). The downloaded image reads these by element id via `drawImage`, so **keep those `<img>` elements in the DOM** even when hidden. To extract them: regex `<img[^>]*id="(\w+)"[^>]*src="data:image/webp;base64,([^"]+)"`.
6. The user works fast and visually: sends screenshots with a one-line instruction, often says "go back", and has preferences that changed several times (see "Decisions"). When a request is genuinely ambiguous, **ask** with 2–4 concrete options (they asked for this explicitly). When a request is clear, just do it.

## Product behaviour

- **Two day tabs** (Day 1 · 18 DEC, Day 2 · 19 DEC), sticky at the top with a frosted-glass backdrop. Each day's plan is stored separately.
- **Sessions have fixed times and rooms.** The visitor only chooses *which session* per time slot. Five slots per day: `9.00–10.30`, `10.45–12.15`, lunch `12.15–13.00`, `13.00–14.30`, `14.45–16.15`, `16.30–18.00`.
- **One session per slot.** Workshops with `span:2` occupy two consecutive slots (never across lunch). Clashes are rejected with a message naming the existing session.
- **Drag and drop is the only way to add** (tap-to-add and "+ Add session" were removed on request). Keyboard Enter/Space on a tray card still adds it for accessibility. Desktop: HTML5 drag. Phones (≤860 px) and coarse pointers: custom pointer-event drag (see "Touch drag").
- **Tray / dock**: shows the sessions that run in the currently selected time slot, with a ‹ › stepper, the day badge ("Day 1 · 18 DEC") and "n of 5 planned". It jumps to the next free slot after each placement. On phones it is a fixed bottom dock with a collapse button.
- **Board**: single column (Time | session card). Empty slots say "Drag a session here" (phones: "Hold a card, then drag it here"). Placed cards have a × button (remove) and can be dragged to move.
- **Finish bar** (`#donebar`, green) appears when a day has 5/5 slots:
  - Day 1 full → "Day 1 is all set! 🎉" + **Plan Day 2 →** button.
  - Day 2 full → "Day 2 is all set! 🎉" + **Download my schedule** (opens the download dialog) + quiet "← Back to Day 1" link.
  - Wording changes if the other day is already full or empty.
- **Toolbar** (one rounded strip): `#png` Download Day n image (primary, gradient), `#copy` Copy as text, `#ics` Add to calendar, `#clear` Reset (has Undo in the toast for 5 s).
- **Download dialog** (`#dlDlg`): Day 1 / Day 2 / Both days in one image. Buttons show the date and "(n/5)" or "(empty)" and are disabled when empty.
- **Calendar export**: `.ics` with one VEVENT per picked session, times converted from Bangkok (UTC+7) to UTC `Z` stamps, title in the current language, location "Room n, venue". Constants `SLOT_TIMES`, `DAY_YMD`. No VTIMEZONE block (not needed with UTC stamps).
- **Language switch** (`#langBtn`, top-right): pill with a flag and the *current* language ("ENG" US flag / "ไทย" Thai flag). Stored in `localStorage['sme-expo-lang']`. Default `en`.
- **Persistence**: `localStorage['sme-expo-agenda-v2'] = {1:{sessionId:startSlot}, 2:{…}}`. Always wrap storage access in try/catch (the artifact sandbox can block it).

## Data model

```js
S = [{ id, day, room /*0-3*/, tag /*'AI & Tech'|'Marketing'|'Tax & Finance'|'Operation'*/,
       lvl /*'Basic'|'Experienced'*/, span /*1|2*/, sp /*speaker count*/,
       t /*'English title : ชื่อภาษาไทย'*/, slot /*derived*/ }]
```
- `slot` is **derived**: sessions in the same `day+room` are placed one after another using `span` (`acc[day-room]` in the IIFE after the S array). When wiring the sheet, use its "Start slot" column directly and delete the derivation.
- `sTitle(s)` returns the English half or the Thai half of `t` depending on language.
- Day 1 ids: `a1–a5` (Room 1), `b1–b5` (Room 2), `c1–c4` (Room 3; `c3` is a 2-slot workshop), `d1–d4` (Room 4; `d1` is a 2-slot workshop). **Day 2 ids `x1–x19` are placeholders** ("Day 2 session title to be announced") mirroring the sheet's Day 2 rows. All speakers are the placeholder "Speaker name / CEO, FlowAccount".
- Rooms: Room 1 `#0e9bd0`, Room 2 `#14b58a`, Room 3 `#ff9b14`, Room 4 `#ff7ea0`. Card colour = room colour; the room name sits bottom-right of each placed card.
- **Google Sheet tabs:** Read me, Event, Rooms, Time slots, Breaks, Sessions, Speakers, Lists. `Sessions` columns A–K are inputs (Session ID, Day, Room, Start slot, Slots, Category, Level, Title EN, Title TH, Speaker 1 ID, Speaker 2 ID); L–O are formulas (End slot, Time, Speakers, Check). Blue text = input, light yellow = placeholder. Day 2 date (19 Dec 2026) is an assumption to confirm.
- **Planned wiring (not done):** publish Event/Rooms/Time slots/Breaks/Sessions/Speakers as CSV and load them at runtime, keeping the page a static file. Note the Claude.ai artifact sandbox blocks outside fetches; a real host does not.

## Header (the "KV" lockup)

Match the event key visual: soft blue/white, Prompt font, rounded white panels, room-coloured cards.

```
[ logo ] | 18 - 19 DECEMBER 2026            ← live text
         | Sasin School of Management      ← live text
         | [ tagline bar image            ] ← transparent WebP 1320×359
```
- Everything scales from one unit: `.kv{--u:calc(min(100vw,1292px)/1292); --tfs:max(30px,calc(var(--u)*104)); --sgap:calc(var(--u)*18)}`; phones (≤860 px): `--tfs:clamp(28px,8.6vw,60px); --sgap:10px`.
- Block width: `.kvstack{width:calc(var(--tfs)*8.111 + var(--sgap))}` (8.111 = star .62em + "AGENDA DAY " 6.848em + number slot .583em + letter-spacing). Grid columns `minmax(0,312fr) minmax(0,48fr) minmax(2px,5fr) minmax(0,48fr) minmax(0,660fr)`, with `width:0;min-width:100%`. The divider is `#0a98d6`.
- Date/venue text sizes are fractions of the info column width using container query units (`container-type:inline-size`): date `7.879cqw` weight 700 `#0499d1`, `word-spacing:-.077em`; venue `6.288cqw` weight 500 `#3f799e`; both `padding-left:5.9%`; bar `margin-top:.264cqw`. These were fitted from the supplied artwork using Prompt font metrics.
- The header is deliberately **not responsive** (user said so): it just scales down. Known issue: on phones the text inside the tagline bar is ~7 px.
- The **"AGENDA DAY n" title is hidden on the landing page** (`.titlebar` is a visually-hidden block, still in the DOM for screen readers and because it holds `#starImg`). The title still appears in downloaded images.
- `.kv` reserves `padding-top:60px` (52 px on phones) for the absolutely positioned language button, which gives ~20 px clearance. The user asked for that gap explicitly.
- **Do not use** the user's `SME_Web_material.png` header artwork: it has two grey ellipses baked into the logo area (export defect). The logo comes from `LOGO_SME_2026.png` (transparent); only the date/venue/tagline block was taken from it, and later replaced by live text + `SME-promt.png` (2640×718 RGBA, transparent) for the bar.

## Visual system

- Font **Prompt** (Thai + Latin). Colours: ink `#1f2a37`, blue `#4a76a3` (titles, times), cyan `#2aa9d6`, navy `#2d3a4a` (Experienced pill), muted `#6b7a89`, ok `#14a36b`, bad `#e04a4a`.
- Page background = supplied artwork `SME_2026_BG.png` (fixed layer `.bgwrap::after`, `--bg-art`). Panels are white with 26–34 px radius and soft blue shadows.
- Cards: 2 px room-coloured border, light room tint when placed, tag pill (room colour) + level pill (Basic outlined / Experienced dark; Thai: พื้นฐาน / ขั้นสูง), title, speaker row (avatar + "Speaker name / CEO, FlowAccount"), room name bottom-right. The × is a 26 px circle (30 px on phones) text glyph, aligned with the level pill. A drawn SVG × was tried and rejected.
- Time column: text 16 px weight 600, **left-aligned**, vertically centred beside the card. Board gap 18 px (16 on phones).
- Sticky day tabs: two equal buttons, label and date on one line; the backdrop is a frosted-glass strip (`.daytabs::before`: blur 16 px, saturate 1.6, mask fading at top and bottom, extends `-40vw` each side so it has no visible edge).
- Breakpoints: `≤1180` tray stacks above the board; `≤900`; `≤860` phone layout (fixed dock, hint bar); `≤480`.

## Touch drag (phones)

Custom pointer-event engine (`bindPDrag`, `pBegin`, `pEval`, `pLoop`, `pFinish`), because HTML5 drag does not work on touch.
- Tray cards and placed cards both need a **press-and-hold of 240 ms** before drag starts (otherwise sideways swipes would grab a card and the dock could not scroll). Movement >10 px before the hold cancels it.
- On start: `setPointerCapture`, `touchmove` is blocked while dragging, a floating copy (`.dghost`) follows the finger lifted `LIFT=64` px above it, and the target is hit-tested at the ghost position. The target slot gets a green/red ghost with the reason. Dropping a placed card on the dock removes it.
- Auto-scroll near the top of the screen or just above the dock after a 240 ms dwell.
- **The user tests phones themselves on real devices.** Do not run or set up phone/mobile testing; keep existing phone code working and avoid breaking it when changing shared code.

## Download image renderer (`drawImage(ds)`)

Canvas, drawn at **2× scale** (CSS width `W=1040`). Called through `downloadDays()` → `fontsReady()` (loads Prompt weights first) → `saveDays()` → `deliver()`. In the Claude.ai artifact it saves through `window.claude.use('downloads')` (declared capability `downloads`); elsewhere it falls back to a blob `<a download>`.
- Layout constants: `PAD=34, IN=34, TW=122, GAP=28, RG=20`; header `TOPPAD=48, TGAP=56, BOTPAD=52`; bottom margin `FOOT=56`.
- **Header mirrors the landing page**: logo | divider | date + venue + tagline bar, sized from a reference `TFS=104`. `Lw = starW + 18 + width("AGENDA DAY ") + slot` (~855 px). The logo block has the *same size in every image*; verified by comparing divider x/height across Day 1, Day 2 and both-days renders.
- **Title / labels** use `titleRow(topY, n, LFS)` with `LFS=72` (user chose 72 over 104/88/56): star + "AGENDA DAY n", centred, day number centred in a fixed slot (`.583em`).
- **Single-day image**: header, title row, one panel.
- **Both days in one image**: header (no title), then for each day a title row ("AGENDA DAY 1", "AGENDA DAY 2") above its panel. Equal gaps (`DGAP=TGAP=56`, label-to-panel `BOTPAD=52`). The old gradient pills ("DAY 1 | 18 DEC"), the "MY AGENDA" title and the "AGENDA DAY 1 & 2" title were all rejected.
- Empty slots draw a dashed "No session picked" card. Lunch band `Lunch Break (12.15 - 13.00)`.
- Times are left-aligned in a block centred in the time column (`tLeft`), two lines centred vertically on the card (`cy∓18`).
- **No footer line** (the "My agenda · 10/10 time slots …" text was removed on request; the code is commented out).
- File names: `my-agenda-day1.png`, `my-agenda-day2.png`, `my-agenda-day1-and-2.png`; calendar: `my-agenda-day{n}.ics`.

## Language (`T()`, `L.en` / `L.th`)

- Static text is applied by `applyLang()`; dynamic text calls `T('key')` (some keys are functions).
- **Always English in both languages** (user decision): the day tabs, "AGENDA DAY n", "Day n · 18 DEC", date/venue header text, the category tags (AI & Tech, …), room names.
- Thai copy **supplied by the user (keep verbatim)**: `dlgT` "โหลดรูป Agenda เก็บไว้เลย"; `dlgP` "สามารถดูตารางทั้งสองวันได้ในรูปเดียว"; `saveTip` "บันทึกตารางเรียนเก็บไว้ดูได้เลย สามารถหยิบมาดูได้ง่ายๆ ตลอดวัน"; `otherDone` "Day n ก็ครบแล้ว เข้าไปดาวน์โหลดหรือปรับแต่งกันเลย"; `nextIs` "ไปจัดตารางเรียน Day n กันต่อ"; `dragDesk` " · ลากไปวางในตารางเลย"; `clear` "รีเซ็ต"; finish heading "Day n is all set! 🎉" (same in both languages).
- All other Thai strings were drafted by the assistant and **need review by a Thai speaker**.

## Decisions (do not re-add these)

Removed or rejected on request: tap-to-select/add and "+ Add session"; "Fill my day for me" (auto-fill); the "Session tray" title text; the Time header box and "My Day 1" bar above the board; the intro paragraph under the header; the five slot-progress dots; the text-built logo; the event-site hero (tagline image, countdown, ticket button); a drag handle on placed cards (press-and-hold instead); the picker bottom-sheet; the "Both days" image with a combined title; the image footer; the date pill beside the title; the stand-alone "Download image" toolbar duplicate in the finish bar.
Kept after back-and-forth: "Add to calendar" lives in the **toolbar**, not in the finish bar. "Reset" (not "Clear my day").

## Testing

1. `node --check` on the extracted script (necessary, not sufficient).
2. `node scripts/render-download.js <1|2|both> <en|th> out.png`: runs the real page in jsdom with `@napi-rs/canvas` (jsdom 31 needs `@napi-rs/canvas`, not `canvas`), loads a saved plan from `localStorage`, clicks the real buttons and writes the PNG. View it. Useful checks: the divider (colour `#0a98d6`) must be at the same x and height in all three images; title height identical across Day 1, Day 2 and both-days.
3. jsdom has **no layout engine**, so CSS (header scaling, mobile dock, sticky glass) cannot be verified there. Verify CSS arithmetic by calculation and, if a real browser is available, with Playwright screenshots at desktop widths only (1292 and 900 px). **Testing scope is desktop only**; the user tests phones themselves.
4. Thai glyphs show as boxes in the harness unless a Thai font is registered. That is a harness limit, not a page bug.

## Open items

1. **Replace placeholder data** (Day 2 titles, all speakers and photos, Day 2 date) by loading the sheet.
2. **Real-device checks (the user does phones; desktop browsers are ours):** touch drag and drop, file downloads, `.ics` opening in Apple/Google Calendar, backdrop-filter and `cqw` support.
3. Thai copy review; consider translating tags and room names if the user wants.
4. Optional ideas the user has not approved: share link (`?p=a1,b6,c13`), default to today's day on 18–19 Dec, first-visit hint for press-and-hold, anonymous pick analytics.
5. Re-export of the header artwork without grey ovals would let the logo come from the same file as the rest (logo colour is currently slightly paler than the artwork's cyan).
6. Phone legibility of the tagline bar (~7 px) and the landing page title now hidden.

## Changes from the impeccable critique (2026-11-09, desktop)

Snapshot: `.impeccable/critique/` (score 26/40 before fixes). All visual changes sit in `@media (min-width:861px)` / `(min-width:1181px)` blocks at the end of the `<style>`, so phone rules are untouched.
- Tray ≥1181px is 340px wide and sticky at `top:84px` (clears the sticky day tabs). Desktop tray titles 14px, pills 11.5px, meta 12px; `--muted` darkened to `#5e6c7a` on desktop.
- Contrast: download gradient starts at `#1679a8`; selected time / slot-arrow hover `#1679a8`; "Drag a session here" at full opacity.
- **Room colour contrast is a preview on Room 3 only** (`.card.r2`: `#a65800` for orange text; pill text stays **white** — user rejected dark pill text). Waiting for the user's OK before rolling out to all rooms (proposed dark text tokens: r0 `#0a6f9a`, r1 `#0b7a5c`, r2 `#a65800`, r3 `#c02d5c`) and to the canvas image.
- Toolbar image button: opens the Day 1 / Day 2 / Both dialog whenever the other day has picks (label "Download image"); otherwise downloads the current day (label "Download Day n image").
- "Add to calendar" now exports every picked session on both days (like Copy as text).
- Workshop time shows as one range ("9.00 - 12.15").
- The 5th pick scrolls the finish bar into view (desktop); "5 of 5 planned" turns green.
- Phones: `.daytabs::before` stops at the page padding (it was `-40vw`, which made iOS browsers in the claude.ai iframe scroll sideways and cut the left side off).
- Keyboard: focus returns to the tray after Enter-add or ×; dialog moves focus in, traps Tab, restores focus; × label names the session and removal has Undo; day tabs use arrow keys (one tab stop).
- **Touch screens wider than 860px** (iPad, phones in landscape) previously could not drag at all (`draggable=!mq&&!COARSE` and `bindPDrag` only when `mq`). Now `bindPDrag` runs when `mq.matches||COARSE`, `html.touch` is set on coarse pointers (touch copy in `.cell::after`, no text selection on cards), and `pLoop` only uses the dock edge for auto-scroll on phones. Published 2026-11-09 (artifact version 108).

## First-time guidance and intro (merged into source 2026-11-11)
Merged from the preview (`preview/agenda-preview.html`) on 2026-11-11 and live on Vercel. Includes: intro under the header (**always shown to every visitor** — user decision; compact single row on phones; smaller on ≤820px-tall laptops); header at 75% on desktop; first-time guidance (direction-aware slot text for side/above/below layouts and touch, blue `#slotMeta`, tray flash + toast on empty-cell click, first-visit nudge label `sme-expo-seen-drag`, tray-card click explains the gesture without adding); phone pressed state, target slot scrolled into view on hold, "Drop it on a time slot" toast on a miss, Undo for dock removal (`removeWithUndo`, also fixes × Undo after a day switch). Rainbow underline on the intro heading was rejected; heading is one colour. Room 3 (`.card.r2`) time and room name use the deeper orange `#a65800`; the other rooms are unchanged (rolling this out to all rooms is undecided).

## Hosting
- GitHub: https://github.com/Rinlada-Sense/fa-sme-agenda (branch `main`).
- Vercel: https://fa-sme-agenda.vercel.app — `vercel.json` copies `source/agenda-day1.html` to `dist/index.html`; only that page is public. Every push to `main` auto-deploys. Commits must be authored as `Rinlada-Sense <354786790+Rinlada-Sense@users.noreply.github.com>` (set in the repo git config); Vercel Hobby blocks deploys from any other author.
- The claude.ai artifact https://claude.ai/artifact/D8MWq6bq4btKfH1jcfuG5o is a separate copy and is only updated when republished.

## Syncing from the Google Sheet (user choice, 2026-11-11)
The page stays self-contained; the sheet is NOT loaded live. When the user says "sync the sheet": read `Sessions!A1:O60` and `Speakers!A1:H60` with the Google Sheets connector, compare row by row with the `S` array (Day 1 ids a1–d4 = D1-01…D1-18 in order; Day 2 rows = D2-01…D2-19 → x1–x19), update titles (`t` is "EN : TH"), category, level, slots, then syntax-check, commit and push (Vercel auto-deploys). Show the user the list of changes. Speakers: the page still shows one generic placeholder (`speaker`/`role` strings) for every session; per-session speakers need code changes (card, canvas image, text copy, .ics) the first time real names appear in the sheet.
First sync 2026-11-11: sheet and page already matched; speakers in the sheet were still placeholders ("Speaker 1"–"Speaker 8", "CEO, FlowAccount", no photos).

## Pick counting (added 2026-11-11)
- Every export (image download, copy as text, .ics) sends one anonymous record per day to a Google Apps Script web app (`PICKS_URL` in the page; script source `scripts/picks-collector.gs`, bound to a separate results sheet the user owns). Record: day, sheet session ID per slot (`SHEET_ID`, e.g. a2 → D1-02, x18 → D2-18; derived from the order of `S`), action (image/text/calendar), lang, device (phone/tablet/desktop), random browser ID (`sme-expo-cid` in localStorage). Nothing personal.
- Sent with `navigator.sendBeacon` (text/plain), fetch no-cors fallback. Skipped on `file:` URLs; the same body is sent once per visit. Blocked on the claude.ai artifact by its CSP (fails silently).
- The collector is bound to the agenda editor sheet itself. Visible tab **Results** (sheetId 9100, first tab): Day 1/Day 2 dropdown in B2 (helper Z1, hidden column), Downloads / People / Most picked session, a "Where people go" room×time grid (picks + % of downloads, colour tiers), "Most picked" ranked list and "What people pick next" (top 15 pairs). Formulas read Picks and Sessions directly. Hidden raw tabs: Picks, Most picked, Next session, Session list (=Sessions!A1:M60). Note: in LET never name a variable `rows` (shadows ROWS).
- The order of `S` must stay in sheet order (D1-01… / D2-01…) or the IDs sent will be wrong.
- Privacy note `#privNote` under the toolbar (Thai text drafted by Claude; needs native review).

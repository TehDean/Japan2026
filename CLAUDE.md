# Japan December Plan: notes for Claude

A day-by-day plan for a trip to Japan, Sun Nov 29 to Sat Dec 5, 2026: Tokyo, plus an overnight in Osaka (Thu 12/3 to Fri 12/4).
It exists in two versions:

- **Website:** https://tehdean.github.io/Japan2026/ (this repo, GitHub Pages from `main`, root). Live street map,
  "Suggest a change" box, installable as a home-screen app, works offline.
- **Claude dashboard:** https://claude.ai/artifact/Y3MLUWwRPqTvWuurwHZghg (the owner's private Claude artifact).
  Stored street map (Claude pages can't load outside map images), no suggestion box. Since automatic suggestions,
  the website is the main version; the dashboard is a snapshot refreshed when the owner asks.

## Suggestions are applied automatically

The owner chose (Oct 19, 2026) to have suggestions applied without checking with them first.
Anyone with the website link can send one, so don't assume who sent it or refer to them by gender;
use the name they gave, or "whoever suggested it."

The box takes suggestions (changes to the plan) and questions (about the plan or the trip); a message can be both.
Questions get an answer in the reply and show as "Answered" (stored as status `skipped`, kind `question`, full
text in `answer`); they never change the plan.

How it works: the website saves a message (`send_trip_suggestion`, no daily limit), then calls the
`apply-suggestion` Edge Function. That function asks Claude (`claude-opus-5-5`, chosen Oct 19, 2026; Anthropic API key in the
`ANTHROPIC_API_KEY` secret) to apply it with a few plan-editing tools, saves the old plan in `trip_plan_versions`,
saves the new plan in `trip_plan`, and marks the suggestion `done` or `skipped` with a reply shown on the site.
Spending is capped by a monthly spend limit on the Anthropic workspace that holds the API key (the owner asked
for a spending cap rather than daily suggestion limits); when it's reached, suggestions wait with a note.
Per-suggestion safeguards: 12 edits and 4 removals at most, places must be in Japan.
Source: `supabase/functions/apply-suggestion/index.ts`; database setup: `supabase_auto_apply.sql`.

When the owner asks to "check the suggestions": summarize what came in and what was changed automatically
(read `trip_suggestions` and `trip_plan.note`), point out anything that looks wrong, and offer to undo it.
To undo, copy the right row of `trip_plan_versions` back into `trip_plan` (ask the owner first).
**Escalations ("Sent to Inari"):** requests the suggestion box can't do with its tools (website design, layout,
features or code, anything needing a person) are escalated, not declined. The kitsune's reply says it carried the
request to the shrine of Inari, its boss; Inari is the owner. Stored as `kind = 'escalated'` (status `skipped`, or
`done` if part of it was done), shown as "⛩️ Sent to Inari". When checking suggestions, list escalated ones first and
ask the owner which to do. After doing one, set its `status` to `done`, `kind` to `change`, and `answer`/`reply` to a
short note in the kitsune's voice (e.g. "Inari approved!").
A scheduled task, "Inari's inbox (Japan plan approvals)", checks every hour (at :19) and sends the owner a
push notification and email only when a new escalated request has arrived (read-only; it uses `list_trip_suggestions_v2`).
"Clear the suggestions" empties the list (`clear_trip_suggestions`, or delete from `trip_suggestions` via the connector).

## Supabase

- Project: **Japan2026**, ref `qsztbfixleqhxovkfaeg`, URL `https://qsztbfixleqhxovkfaeg.supabase.co`.
  The publishable key in `tools/parts/suggest_js.js` is public and safe in the page.
- The owner's account also has an **Adult Fun Finder** project. Never change it unless the owner asks.
- Tables: `trip_plan` (the live plan, one row), `trip_plan_versions` (history), `trip_suggestions`.
  Website functions: `get_trip_plan`, `send_trip_suggestion`, `list_trip_suggestions_v2`.
  Key-protected: `mark_trip_suggestion(p_key, p_id, p_status, p_reply)`, `clear_trip_suggestions(p_key)`.
- The review key is private and is **not** in this repo. Either ask the owner to paste it, or, if the Supabase
  connector is available, read and update `trip_suggestions` directly on the Japan2026 project.
- Setup scripts: `supabase_suggestions.sql`, `supabase_clear.sql`, `supabase_auto_apply.sql` (all already applied).

## Editing the plan

- The live plan is `trip_plan.data` in Supabase ({places, days}); the website loads it on every visit.
  Make manual plan changes there (save the old data to `trip_plan_versions` first). Also copy the result into
  `DEFAULT_PLACES` / `DEFAULT_DAYS` in `tools/page_template.html` when updating the Claude dashboard, which is a
  snapshot built from those (it can't read Supabase) and is the website's offline fallback.
- **Info tabs after the days:** `INFO_TABS` in `tools/page_template.html` (static, not in Supabase), added Oct 19, 2026.
  **Hotels** (`HOTEL_STAYS`, `showHotels`; temporary, remove once hotels are booked) and **eSIM** (`ESIM`, `showEsim`;
  recommends the Sakura Mobile Unlimited eSIM, 7 days, one per phone). To remove a tab, drop its `INFO_TABS` entry
  and its data/render function; the shared hotel-card CSS is also used by the eSIM tab.
- **Stop photos (website only):** `tools/parts/photos_js.js` finds each stop's photo on English Wikipedia in the
  visitor's browser (matching article near the pin, else nearest article, labeled "Nearby"). A place can set
  `photo` to a Wikipedia article title, or `"none"` to hide it; the suggestion box can set this too. The Claude
  dashboard has no photos (it can't load outside images).
- Website-only pieces are in `tools/parts/`. Don't edit `index.html` by hand; it is generated.
- Build both versions: `python3 tools/build.py` → `index.html` (website) and `tools/build/dashboard.html` (Claude).
- Owner's preferences for the plan: keep each day's stops close together (no crossing town); sushi a few times,
  not daily; plenty of street food and markets; Sunday 11/29 starts around 5:30 PM (they land about 2 PM).
- Every stop needs real coordinates; mark ones placed from general knowledge as approximate in its note.
- The stored dashboard map covers greater Tokyo and Osaka. A stop outside those areas needs new map pieces:
  add the area to `tools/fetch_tiles.py`, run `python3 tools/fetch_tiles.py tools/build/tiles tools/build/tiles_raw`,
  and publish the regenerated `t*.js` and `tile-index.js` files with the dashboard. Also widen `map.setMaxBounds`.
- Publish the dashboard by republishing `tools/build/dashboard.html` to the artifact URL above (its map files are
  kept between versions unless the tiles change). Push the website by committing to `main`.
- Check both builds at phone width (about 390 px) and desktop, in light and dark mode, before publishing.

# Japan December Plan: notes for Claude

A day-by-day plan for a trip to Japan, Sun Nov 29 to Sat Dec 5, 2026: Tokyo, plus an overnight in Osaka (Thu 12/3 to Fri 12/4).
It exists in two versions that must always show the same plan:

- **Website:** https://tehdean.github.io/Japan2026/ (this repo, GitHub Pages from `main`, root). Live street map,
  "Suggest a change" box, installable as a home-screen app, works offline.
- **Claude dashboard:** https://claude.ai/artifact/Y3MLUWwRPqTvWuurwHZghg (the owner's private Claude artifact).
  Stored street map (Claude pages can't load outside map images), no suggestion box.

## Suggestions: always ask the owner before acting

Anyone with the website link can send a suggestion, so don't assume who sent it or refer to them by gender;
use the name they gave, or "whoever suggested it."

When asked to "check the suggestions":
1. Read them (see Supabase below) and list the new ones: who sent it, which day, what they asked for,
   what it would change in the plan, and anything to flag (cost, closures, travel time, conflicts).
2. **Wait for the owner to choose** which to do, skip or adjust. Do not change the plan before they decide.
3. Make only the approved changes, update **both** versions, then mark each suggestion `done` or `skipped`
   with a short, friendly `reply` that is shown on the website.
4. "Clear the suggestions" empties the list (`clear_trip_suggestions`).

## Supabase

- Project: **Japan2026**, ref `qsztbfixleqhxovkfaeg`, URL `https://qsztbfixleqhxovkfaeg.supabase.co`.
  The publishable key in `tools/parts/suggest_js.js` is public and safe in the page.
- The owner's account also has an **Adult Fun Finder** project. Never change it unless the owner asks.
- Table `trip_suggestions`; functions `suggest_trip_change`, `list_trip_suggestions` (open to the website),
  `mark_trip_suggestion(p_key, p_id, p_status, p_reply)` and `clear_trip_suggestions(p_key)` (need the review key).
- The review key is private and is **not** in this repo. Either ask the owner to paste it, or, if the Supabase
  connector is available, read and update `trip_suggestions` directly on the Japan2026 project.
- Setup scripts: `supabase_suggestions.sql`, `supabase_clear.sql` (already run).

## Editing the plan

- Source of truth: `tools/page_template.html` (the `DEFAULT_PLACES` and `DEFAULT_DAYS` data near the top of the script).
  Website-only pieces are in `tools/parts/`. Don't edit `index.html` by hand; it is generated.
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

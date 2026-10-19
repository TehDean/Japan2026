# Japan 2026

Day-by-day Japan plan for Nov 29 to Dec 5, 2026: Tokyo plus an overnight in Osaka, with sights, sushi, street food and a live street map.

**Live site:** https://tehdean.github.io/Japan2026/

## Files

- `index.html` – the website.
- `manifest.webmanifest`, `icon-*.png` – let people add the site to their phone's home screen like an app.
- `sw.js` – keeps the site working offline: the page, the map library and the map areas already viewed.
- `supabase/functions/apply-suggestion/` – the Supabase Edge Function that applies suggestions to the plan automatically.
- `supabase_auto_apply.sql` – database setup for the live plan and automatic suggestions (already applied).
- `supabase_suggestions.sql` – one-time database setup for the "Suggest a change" box (run in the Supabase SQL Editor of the japan2026 project). The box stays hidden until this has been run.
- `supabase_clear.sql` – optional one-time setup that lets the review key clear the suggestion list.
- `tools/` – the source the pages are built from (`python3 tools/build.py`).
- `CLAUDE.md` – notes for Claude on how this project and its suggestion box work.

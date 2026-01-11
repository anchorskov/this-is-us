# Hugo Layout Mismatch – Pending Bills Page

## Symptom
- `/civic/pending/` rendered only the title; no cards/nav/debug bar despite Worker and JS loading.
- Browser console showed page context `Template=civic/pending-bills Kind=page Section=civic URL=/civic/pending/`, but layout CSS/HTML (red debug bar) did not appear.

## Root Cause
- Hugo picked a default single template because the front matter used `layout: "civic/pending-bills"` without a matching `type`. The intended template lives at `layouts/civic/pending-bills.html`, which Hugo resolves via `type + layout`. Without `type: "civic"`, the layout wasn’t applied, so the pending-bills UI never mounted.

## Fix
- Set front matter on `content/civic/pending.md` to:
  ```toml
  title: "Pending Wyoming Bills"
  type: "civic"
  layout: "pending-bills"
  description: "See pending Wyoming legislation, filter by hot-button topics, and grab a ready-made AI prompt to explain each bill."
  ```
- Confirm the layout now renders (red debug bar + tabs + filters) and that `static/js/civic/pending-bills.js` hydrates the cards.

## Verification Steps
1. `hugo server --baseURL http://localhost:1313 --bind 0.0.0.0`
2. `./scripts/wr dev --local` in `worker/` (ensure pending-bills endpoint returns data).
3. Visit `http://localhost:1313/civic/pending/`; ensure red debug bar and cards appear.
4. Network tab: `200` from `/api/civic/pending-bills-with-topics` and non-empty JSON payload.

## Notes
- Hot Topics list now uses a dedicated module (`static/js/civic/hot-topics.js`) loaded via `<script type="module">`, matching the pattern used on pending bills.
- The shared local nav partial lives at `layouts/partials/civic-nav.html`; both pages include it.

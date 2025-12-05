# Hot Topics UX Flow (Local Dev)

## Stack
- Hugo serves pages on 127.0.0.1:1313
- Worker serves APIs on 127.0.0.1:8787
- `?useLocalWorker=1` (or browsing via 8787) points the frontend to the local Worker

## Data flow
1) List page (`/hot-topics`) calls `/api/hot-topics` (EVENTS_DB + WY_DB merge) and renders cards.
2) Detail page (`/hot-topics/:slug`) calls `/api/hot-topics/:slug`, which joins civic_items IDs from EVENTS_DB with civic_items data from WY_DB.
3) Each bill shows title/status and votes. Buttons: 👍 (support), 👎 (oppose), ❓ (need info). Votes POST to `/api/civic/items/:id/vote` (WY_DB), keyed by `user_id` (Firebase UID), updating counts via the existing `votes` table (`target_type='civic_item'`) and reflecting totals in the UI.

## Key preconditions / error states
- Local Worker must be running on 8787; otherwise, `/api/*` 404s. The site-scripts probe only switches to local when `/api/_health` returns 200.
- If the probe fails, frontend stays on remote `/api`. Use `?useLocalWorker=1` to force local when on Hugo.
- If civic_items are missing, the detail page shows “No bills linked yet.”
- Votes require a signed-in user (Firebase UID). Counts are aggregated per bill from `votes` (target_type='civic_item'; value: 1=up, -1=down, 0=info).

## UI affordances
- Loading/error states on hot-topics list/detail; vote buttons disable during request.
- Vote failures show inline message; successes update counts in-place; tooltips on hover explain each button.

## Common commands
- Start both: `./start_local.sh` (Hugo background, wrangler foreground on 8787)
- APIs: `curl -i http://127.0.0.1:8787/api/_health`, `.../api/hot-topics`
- Pages: `http://127.0.0.1:8787/hot-topics` or `http://127.0.0.1:1313/hot-topics/?useLocalWorker=1`

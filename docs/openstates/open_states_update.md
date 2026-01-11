<!-- File: documentation/open_states_update.md -->

# Open States Integration Plan – This Is Us Project

**Goal:** Integrate a Wyoming “Legislative Snapshot” service into the existing This Is Us stack. We will poll Open States v3, normalize the data, store it in the current Cloudflare D1 database, and expose recent changes through our Hugo UI. Every record should link back to the corresponding `wyoleg.gov` page for verification.

**Integration Approach:** Extend the current Worker/D1 deployment. Add new tables via migrations, add Open States routes under the existing router, and reuse our hosting + auth patterns instead of spinning up a separate project.

---

## 1) Project Structure (existing)

Everything lives in the current repo:

```bash
~/projects/this-is-us/
├── worker/
│   ├── src/
│   │   ├── index.mjs          # Main router – add Open States routes here
│   │   ├── routes/            # Add openstates/ subdirectory
│   │   └── utils/             # Add shared helpers if needed
│   └── ./scripts/wr.toml          # Update bindings/vars
├── sql/                       # Add new D1 migrations here
├── documentation/             # This file
└── layouts/                   # Hugo templates (optional UI updates)
```

---

## 2) D1 Schema Additions

Append two migrations to the existing SQL folder.

**`sql/0010_openstates_init.sql`**

Create tables: `bills`, `bill_versions`, `bill_actions`, `bill_sponsors`, `bill_snapshots`.

- `bills`: `bill_id` (TEXT PK, OCD or composed), `session`, `number`, `title`, `chamber`, `subjects_json`, `openstates_id`, `wy_url`, `created_at`, `updated_at`
- `bill_versions`: `version_id` (TEXT PK), `bill_id` FK, `url`, `date`, `sha256`, `is_current`
- `bill_actions`: `id` PK, `bill_id` FK, `date`, `actor`, `action`, `raw`
- `bill_sponsors`: `id` PK, `bill_id` FK, `name`, `role`
- `bill_snapshots`: `id` PK, `bill_id` FK, `snapshot_json`, `snapshot_hash`, `created_at`

**`sql/0011_openstates_indexes.sql`**

- Indexes for `bills(session, number)`, `bill_actions(bill_id, date)`, `bill_versions(bill_id, date)`, `bill_snapshots(bill_id, created_at)`
- Unique constraints on `bill_versions(sha256)` and `bill_snapshots(snapshot_hash, bill_id)`

Both migrations target the existing D1 binding (currently referenced as `DB`/`EVENTS_DB`).

---

## 3) Wrangler Config Updates

Update `worker/./scripts/wr.toml`:

```toml
[vars]
# existing vars ...
DEFAULT_JURISDICTION = "Wyoming"
```

Secrets:

```bash
cd worker
./scripts/wr secret put OPENSTATES_API_KEY
```

No new D1 bindings required—the existing `DB` binding will store the Open States tables.

---

## 4) Worker Routes

Update `worker/src/index.mjs`:

```javascript
import {
  handleBillsSearch,
  handleBillDetail,
  handleIngest,
  handleChanged,
  handleHealth,
} from "./routes/openstates/index.js";

router
  .get("/api/openstates/health", handleHealth)
  .get("/api/openstates/bills/search", handleBillsSearch)
  .get("/api/openstates/bills/:jurisdiction/:session/:id", handleBillDetail)
  .post("/api/openstates/ingest/:jurisdiction/:session", handleIngest)
  .get("/api/openstates/changed", handleChanged);
```

Create `worker/src/routes/openstates/index.js` (or split into modules) with handlers:

- `GET /api/openstates/health`: `{ ok: true }`
- `GET /api/openstates/bills/search?session=2025&query=education`: call Open States `/bills`, normalize rows, include `wy_url`
- `GET /api/openstates/bills/:jurisdiction/:session/:id`: single-bill fetch returning canonical snapshot JSON
- `POST /api/openstates/ingest/:jurisdiction/:session`: paginate Open States results, upsert bills/actions/versions/sponsors, compute `snapshot_hash`, and record new snapshots
- `GET /api/openstates/changed?since=ISO_DATE`: list bills with snapshots newer than `since`

Implementation requirements:

- Shared fetch helper that injects `X-API-KEY`
- `sha256` helper for version/snapshot hashing
- `upsertBill` + `writeSnapshot` helpers using D1 prepared statements
- Parameter validation/sanitization
- Reuse existing CORS + auth wiring (Firebase tokens, etc.)

---

## 5) UI Integration Options

**Option A – Hugo section:**
Add `content/openstates/` and templates that call the API (e.g., list page hitting `/api/openstates/changed`).

**Option B – Static page:**
Add `static/openstates/index.html` that loads via fetch. Table columns: Bill, Title, Last Action, Last Seen, Changed. Each row links to `wy_url` and `/api/openstates/bills/{jurisdiction}/{session}/{id}` JSON.

---

## 6) Helper Utilities

Create `worker/src/routes/openstates/utils/` with:

- `openstates.js`: `fetchJson(path, params)` + pagination + mappers for `wy_url`, actions, sponsors, versions
- `crypto.js`: `sha256Hex(input)`
- `db.js`: thin D1 helpers for upserts/queries
- `normalize.js`: canonical mapping functions for snapshot JSON

---

## 7) Seed & Crawl Scripts

**`scripts/openstates-seed.sh`**

```bash
#!/bin/bash
set -euo pipefail
SESSION=${SESSION:-2025}

cd worker
./scripts/wr d1 execute DB --file ../sql/0010_openstates_init.sql
./scripts/wr d1 execute DB --file ../sql/0011_openstates_indexes.sql

cd ..
echo "=== Ingesting session $SESSION ==="
curl -X POST "http://127.0.0.1:8787/api/openstates/ingest/Wyoming/$SESSION"

./scripts/wr d1 execute DB --command "SELECT COUNT(*) AS count FROM bills;"
./scripts/wr d1 execute DB --command "SELECT COUNT(*) AS count FROM bill_actions;"
./scripts/wr d1 execute DB --command "SELECT COUNT(*) AS count FROM bill_snapshots;"
```

**`scripts/openstates-crawl.sh`**

```bash
#!/bin/bash
set -euo pipefail
SESSION=${SESSION:-2025}

echo "=== Checking for updates ($SESSION) ==="
curl -X POST "http://127.0.0.1:8787/api/openstates/ingest/Wyoming/$SESSION"

./scripts/wr d1 execute DB --command "SELECT COUNT(*) FROM bill_snapshots WHERE created_at > datetime('now', '-1 hour');"
```

---

## 8) Local Development & Testing

```bash
cd ~/projects/this-is-us/worker
./scripts/wr secret put OPENSTATES_API_KEY   # once
./scripts/wr dev --local

cd ~/projects/this-is-us
bash scripts/openstates-seed.sh

curl -s 'http://127.0.0.1:8787/api/openstates/health' | jq .
curl -s 'http://127.0.0.1:8787/api/openstates/bills/search?session=2025&query=education' | jq '.[0]'
```

---

## 9) Snapshot Rules

Snapshot JSON structure:

- `bill`: `{ number, session, title, chamber, subjects }`
- `status`: `{ text, date }` derived from most recent action
- `sponsors`: `[ { name, role } ]`
- `docs`: `{ wy_url, openstates_id, latest_version }`

Compute `snapshot_hash = sha256(canonicalJSONString(snapshot))`. Insert into `bill_snapshots` only if the hash differs from the most recent entry for that `bill_id`.

---

## 10) Mapping Rules

- `bill_id`: Open States OCD ID if present, otherwise `Wyoming:SESSION:NUMBER`
- `number`: `identifier` or `bill_number`
- `session`: `legislative_session.identifier` or top-level `session`
- `chamber`: `from_organization.name`
- `wy_url`: first source/version URL containing `wyoleg.gov`
- `actions`: map to `{ date, actor (organization.name), action (description), raw }`
- `sponsors`: `{ name, role = classification }`
- `versions`: store URL + note; hash the URL string for `sha256` placeholder until we fetch PDFs

---

## 11) Change Monitoring

- Add `updated_since` query param support to `/api/openstates/bills/search`
- In `./scripts/wr.toml`, add a cron trigger (e.g., every 6 hours) and in the Worker’s `scheduled()` handler call `handleIngest` for the active session

```toml
[triggers]
crons = ["0 */6 * * *"]
```

```javascript
export default {
  async scheduled(controller, env, ctx) {
    const session = new Date().getFullYear();
    await handleIngest({ params: { jurisdiction: "Wyoming", session } }, env, ctx);
  },
};
```

---

## 12) Security Alignment

- Keep Firebase auth enforcement consistent with existing routes (derive `user_id` server-side if needed)
- Reuse CORS helper from `worker/src/utils/cors.js`
- Honor the existing `window.EVENTS_API_URL`/`apiRoot` patterns in Hugo
- Consider Cloudflare rate limiting if ingest endpoints are opened to the public

---

## 13) Production Deploy

```bash
cd ~/projects/this-is-us/worker
./scripts/wr deploy
curl -s 'https://volunteers.grassrootsmvt.org/api/openstates/health' | jq .
```

Checklist:

- [ ] Migrations tested locally
- [ ] API endpoints verified
- [ ] `OPENSTATES_API_KEY` secret present in production
- [ ] Router + CORS behave as expected
- [ ] UI entry point live (Hugo or static)

---

## 14) Migration Workflow (branch `upgrade1125`)

1. Add SQL migrations (`0010`, `0011`)
2. Create `worker/src/routes/openstates/` handlers + utils
3. Mount routes in `worker/src/index.mjs`
4. Run `./scripts/wr dev --local`
5. Apply migrations locally (`./scripts/wr d1 execute DB --local --file sql/0010_openstates_init.sql`)
6. Run `scripts/openstates-seed.sh`
7. Inspect data in D1 (`./scripts/wr d1 execute DB --command "SELECT * FROM bills LIMIT 1"`)
8. Merge after review, apply migrations to prod, deploy Worker

---

## 15) Issue-Area Filters

Enhance `/api/openstates/bills/search`:

- `subject=education|elections|energy|budget`
- Case-insensitive `sponsor=<name>` filter
- Pagination: `limit` (≤100) + `page`

---

## 16) Integration Checklist

- [ ] D1 migrations added (`sql/0010_*`, `sql/0011_*`)
- [ ] Route handlers under `worker/src/routes/openstates/`
- [ ] Utility modules created
- [ ] Main router updated
- [ ] Seed/crawl scripts added
- [ ] API key secret stored
- [ ] Local tests complete
- [ ] UI integration path chosen & implemented
- [ ] Documentation updated (this file)
- [ ] Deployment plan reviewed

---

## 17) File Structure After Integration

```
~/projects/this-is-us/
├── worker/
│   ├── src/
│   │   ├── index.mjs                      # + Open States routes
│   │   ├── routes/
│   │   │   ├── events.js                  # existing
│   │   │   ├── preferences.js             # existing
│   │   │   └── openstates/                # new
│   │   │       ├── index.js               # handlers
│   │   │       └── utils/
│   │   │           ├── openstates.js      # API client
│   │   │           ├── crypto.js          # hashing
│   │   │           ├── db.js              # D1 helpers
│   │   │           └── normalize.js       # mapping
│   │   └── utils/cors.js                  # existing
│   └── ./scripts/wr.toml                      # updated vars/cron
├── sql/
│   ├── 0010_openstates_init.sql
│   └── 0011_openstates_indexes.sql
├── scripts/
│   ├── openstates-seed.sh
│   └── openstates-crawl.sh
├── content/openstates/ (optional)
└── static/openstates/  (optional)
```

---

## 18) Post-MVP Ideas

- Capture vote records when Open States provides them
- Add committee event tracking for upcoming hearings
- Store per-bill “watch notes” and send alerts via our existing notification system
- Provide CSV export for bills changed in the last 7 days
- Add `/api/openstates/meta` for diagnostics
- Show a badge in the UI for bills with snapshots < 24 hours old

---

## Done When

- Local ingest stores at least one snapshot
- `/api/openstates/changed` returns recent updates
- UI lists changes with working `wyoleg.gov` links
- Production route responds within ~500 ms on cache hit
- Existing routes remain unaffected

---

## Notes

- Database: existing D1 binding (`DB`/`EVENTS_DB`)
- Routes: all Open States endpoints live under `/api/openstates/*`
- Branch: `upgrade1125`
- Auth/CORS: reuse existing Worker patterns
- Worker: single deployment; no new services

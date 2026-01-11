# Wyoming LSO Ingestion: Next Actions

Ordered, high-impact tasks with validation commands.

1) Apply local migrations with persistence
   - `cd worker && ./scripts/apply-migrations-local.sh`
   - Validate: `XDG_CONFIG_HOME=./.config ./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command "SELECT name FROM d1_migrations;" --json`

2) Ensure single persist dir in dev runs
   - Start via `./start_local.sh` (uses --persist-to ./worker/../scripts/wr-persist).
   - Validate: `find worker/../scripts/wr-persist -name "*.sqlite"`

3) Run full wyoleg pipeline locally (fresh)
   - `cd worker && ./scripts/test-wyoleg-pipeline-local.sh --reset`
   - Validate: script reports summaries/tags > 0 and civic_item_sources populated.

4) Audit ingestion state
   - `cd worker && ./scripts/audit-wyoleg-ingestion.sh`
   - Validate: report shows required tables present and counts (bills, sources, summaries, tags).

5) Hot-topics linkage sanity
   - If needed, seed hot_topic_civic_items with current bills (manual/SQL).
   - Validate: `./scripts/wr d1 execute EVENTS_DB --local --persist-to ./../scripts/wr-persist --command "SELECT COUNT(*) FROM hot_topic_civic_items;" --json`

6) Remote schema parity check
   - `cd worker && XDG_CONFIG_HOME=./.config ./scripts/wr d1 migrations list WY_DB --remote`
   - Validate: compare against local `d1_migrations`; apply if missing.

7) Doc resolver spot check
   - `cd worker && BILL=SF0013 YEAR=2026 DEBUG=1 ./scripts/test-doc-resolver-local.sh`
   - Validate: output shows best URL ending in Introduced/Enroll/Digest/Fiscal PDF.

8) Pending-bills API smoke
   - With worker running: `curl -s http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'`
   - Validate: count > 0.

9) Hot-topics API smoke
   - `curl -s http://127.0.0.1:8787/api/hot-topics | jq 'length'`
   - Validate: length matches hot_topics count; no 500s.

10) Commit/update snapshot doc
    - Update `instructions/database_snapshot_12-14-25.md` with current counts and migrations once above passes.

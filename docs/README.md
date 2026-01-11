# Project Documentation Hub

Status: Active
Updated: 2025-12-17
Owner: Eng Platform
Scope: Documentation standards

Central home for all project docs. Use this to keep guides discoverable and consistent across domains.

## Target structure
- `docs/bill-scanner/` – pipeline, deployments, runbooks
- `docs/pending-bills/` – UI, API, refresh jobs
- `docs/townhall/` – map UI, threads, worker/D1
- `docs/civic-watch/` – analyzer, delegation API, watchdog tools
- `docs/geocoding/` – geocode workflow, ingestion, backfills
- `docs/platform/` – auth, Firestore rules, deployments, playbooks
- `docs/archive/` – dated superseded docs, snapshots, logs
- `docs/templates/` – shared templates (index, runbook, postmortem)

## How to add or update docs
1) Pick the right domain folder (create it if missing).  
2) Start from a template in `docs/templates/`.  
3) Add the status header (see below).  
4) Keep filenames short: `<domain>_<type>.md` (e.g., `bill-scanner_runbook.md`).  
5) Update the domain `INDEX.md` and this page when you add or retire docs.  
6) Move old versions/logs into `docs/archive/` with a date suffix (e.g., `*_2025-02-10.md`).

## Status header (required)
Place at the top of every doc:

```
Status: Draft | Active | Archived
Updated: YYYY-MM-DD
Owner: name or team
Scope: domain/topic
```

## Current pointers
- Bill Scanner: `docs/bill-scanner/INDEX.md`
- Pending Bills: `docs/pending-bills/INDEX.md`
- Town Hall: `docs/townhall/INDEX.md`
- Civic Watch: `docs/civic-watch/INDEX.md`
- Geocoding: `docs/geocoding/INDEX.md`
- Platform/Deploy/Rules: `docs/platform/INDEX.md`
- Hot Topics: `docs/hot-topics/INDEX.md`
- Podcast Summaries: `docs/podcast/INDEX.md`
- WY Legislature ingestion: `docs/ingestion-wyoleg/INDEX.md`
- Delegation API: `docs/delegation-api/INDEX.md`
- OpenStates: `docs/openstates/INDEX.md`
- Hardening: `docs/hardening/INDEX.md`
- Phase 2: `docs/phase-2/INDEX.md`
- Address validation: `docs/address-validation/INDEX.md`
- Verified voter: `docs/verified-voter/INDEX.md`

## Doc types
- `INDEX` – map of all docs for a domain, “start here” link
- `Quickstart` – 1-page summary of how to run/verify
- `Runbook` – step-by-step execution with validation/rollback
- `Postmortem` – incident summary, actions, owners
- `Delivery` – what shipped, where to find it, acceptance checks

## Checks
- Run `python3 scripts/check-docs-status.py` to find docs missing the status header (skips templates/archive).

## Archiving rules
- When superseded, move the old file to `docs/archive/` and add `Archived` to the status header.
- Keep logs and one-off reports in `docs/archive/` to reduce root clutter.
- If content is still relevant but aged, refresh the `Updated` date and note what changed.

# AI Documentation Contract

Status: Active  
Updated: 2025-12-17  
Owner: Eng Platform  
Scope: AI-created or AI-edited documentation

## Rules
- Write docs inside `docs/<domain>/`; do not add new Markdown/text files to the repo root.
- Include the status header on every doc (except `INDEX.md`, `docs/README.md`, and archives):
  ```
  Status: Draft | Active | Archived
  Updated: YYYY-MM-DD
  Owner: <team/person>
  Scope: <domain/topic>
  ```
- Use short filenames: `<domain>_<type>.md` (example: `bill-scanner_runbook.md`).
- Update the domain `INDEX.md` “Start here” section when adding a primary guide.
- Archive superseded content in `docs/archive/` with `Status: Archived` and a date suffix in the filename.
- If links change, update references to point at the new `docs/<domain>/...` path.
- Run `python3 scripts/check-docs-status.py` before finishing doc work (enforces status headers).

## Workflow conventions
- Provide copy-pasteable WSL commands first.
- When exporting an output file for review (WSL/Windows only), copy it to `/mnt/c/Users/ancho/Downloads/`.
- Always bundle or concatenate multiple documentation or review files:
  - Default output name: `<topic>_review_<YYYYMMDD>.txt`
  - Create the bundle in `tmp/` (if present), then copy to Windows Downloads.
  - Prefer deterministic file ordering (explicit list or a sorted glob).
- Copilot should read `.github/copilot-instructions.md` for repo-specific runtime steps.
- Wrangler and Hugo are started by Jimmy via `./start_local.sh`; Copilot must not start or restart servers.
- Use `docs/dev/` for local workflow docs (do not add new root docs for dev instructions).

## When uncertain
- Default to `Status: Draft`, `Owner: Eng Platform`, and add a short note listing open questions.
- Keep changes small. Leave TODOs for human follow-up rather than guessing.

## Local Wrangler and D1 rules (must follow)
- Run all `./scripts/wr` commands from the `worker/` directory.
- Local D1 must use a single persisted directory:
  - Persist dir: `worker/../scripts/wr-persist`
- For local dev:
  - Start with: `cd worker && ./scripts/wr dev --persist-to ./../scripts/wr-persist`
- For local D1 commands:
  - Always include: `--persist-to ./../scripts/wr-persist`
- If multiple local D1 stores exist (example: `worker/../scripts/wr/state/...`), do not delete automatically.
  - Run `worker/scripts/guardrails/check-local-d1-context.sh` and fix scripts to enforce the single persist dir.

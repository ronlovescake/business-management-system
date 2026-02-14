# Temporary Script Retention

This folder stores ad-hoc and one-off maintenance scripts that are not part of the permanent application runtime.

## Folder layout

- `root-archive/`: migrated scripts previously kept at repository root as `tmp-*.ts`.

## Policy

- Do not add new `tmp-*.ts` files in repository root.
- Place temporary scripts under `scripts/tmp/`.
- Use clear prefixes for intent (for example: `qa-`, `fix-`, `audit-`, `backfill-`).
- Treat these scripts as disposable operational tooling; do not import them from application code.
- Move stale scripts to archive subfolders or remove them after verification.

## Safety guidance

- Run against test/sandbox data first.
- Prefer dry-run modes where available.
- Document assumptions and expected side effects in script headers.

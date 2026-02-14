# TMP Script Retention Policy

## Purpose

Keep repository root clean and reduce operational risk from stale ad-hoc scripts.

## Rules

- Repository root must not contain new `tmp-*.ts` files.
- Temporary operational scripts must live under `scripts/tmp/`.
- Existing legacy root tmp scripts are archived under `scripts/tmp/root-archive/`.
- Temporary scripts must not be imported by app/runtime modules.

## Lifecycle

1. Create script in `scripts/tmp/` with a descriptive name.
2. Run and validate in non-production context first.
3. Keep only while actively needed.
4. Archive or delete after use.

## Naming

Use intent-driven prefixes when possible:

- `qa-`
- `fix-`
- `audit-`
- `backfill-`
- `reconcile-`

## Ownership

Script author is responsible for:

- adding execution notes,
- documenting data assumptions,
- and cleaning up obsolete scripts.

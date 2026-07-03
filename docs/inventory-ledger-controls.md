# Inventory Ledger Controls

This repo includes two safety checks for the `inventory_movements` ledger:

- **Healthcheck**: flags negative bucket balances (sellable is treated as critical).
- **Drift check**: compares `products.quantity` vs ledger-derived sellable balance.

## Run locally / CI

- `npm run inventory:ledger:healthcheck`
- `npm run inventory:ledger:drift`
- `npm run inventory:ledger:controls` (runs both)

Notes:

- Drift defaults to `--onlyWithMovements` and `--minAbsDelta 0.000001` to avoid noise during rollout.
- Both scripts exit non-zero when failing conditions are detected.

## Common failure mode: negative sellable after historical sale backfill

If the ledger was **seeded** using an “opening balance” / receipt backfill (e.g., a single `scrap -> sellable` movement like `receipt-backfill`) and you also ran the **historical sales** backfill (`auto-sale txn ...`), you can end up with negative sellable because the ledger is subtracting historical sales from an already-net opening balance.

Auto-generated reserve and sale movements now carry nullable source metadata (`sourceTransactionId`, `movementSource`, `movementType`) in addition to human-readable notes. Existing historical rows can be upgraded without changing quantities or buckets:

- Dry run: `npm run -s inventory:movements:backfill-traceability -- --domain all --limit 500`
- Apply metadata-only updates: `npm run -s inventory:movements:backfill-traceability -- --apply --domain all --limit 500`

To safely remove the historical auto-sale backfill movements, run:

- Dry run (shows what would be deleted): `npm run -s inventory:ledger:rollback-sales-backfill`
- Apply soft-delete: `npm run -s inventory:ledger:rollback-sales-backfill -- --apply`

Optional: scope to a specific SKU suffix in parentheses:

- `npm run -s inventory:ledger:rollback-sales-backfill -- --productCodeContains "(BS-090525)"`

## Optional scheduled execution (internal API)

There is a protected endpoint intended for cron/schedulers:

- `POST /api/internal/inventory/controls`

Auth:

- Set `INTERNAL_JOB_TOKEN` on the server.
- Send header `x-internal-token: <token>`.

The endpoint returns JSON with `ok`, drift rows, and negative balance summaries.

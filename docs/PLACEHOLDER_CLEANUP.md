# Placeholder Transaction Cleanup

The transactions grid historically created placeholder rows (all blank data with a shipment code of `-`). These rows clutter backups and exports because they are written to the `transactions` table just like real orders.

Use the cleanup script to safely remove them:

```bash
# Dry-run (recommended first)
npm run db:cleanup-placeholders

# Delete placeholders after reviewing the dry-run output
npm run db:cleanup-placeholders -- --apply
```

The script:

- Loads connection settings from `.env.local` (override with `CLEANUP_ENV_FILE`).
- Targets only rows where shipment code is `-` **and** all key fields (dates, customer, product, quantities, financials, notes, statuses) are blank/zero.
- Prints a sample of IDs before deleting anything.

Always run a backup before deletion if you have any doubt about your current dataset.

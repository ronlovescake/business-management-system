# Development Supplier-Migration Recovery

Date: 2026-10-26. Scope: development only. This is an operational evidence record,
not financial reconciliation or certification of the full migration history.

## Outcome And Authorization

The owner authorized backup of `localhost:5435/business_management`, restore and
Prisma 5.22 deployment rehearsal on a disposable copy, development application of
only the supplier-credit migration if verification passed, and separate recovery
and investigation of older migration history.

Backup, rehearsal, development migration and Products verification passed. The
supplier migration is applied. Historical recovery is partial: two edited files
were restored and one missing file recovered, but 43 originals are unavailable
in the checked local sources. Two blank checksums remain unchanged and unproven.

Production, its checkout/database, and the existing test database on port 5433
were not accessed by this recovery. No production build, commit, push, deployment,
reset, `db push`, migration-record deletion, or checksum overwrite was performed.
No supplier credit/application/transfer, payment, journal, or inventory adjustment
was created. The clothing pricing-estimate Shipping Fee Calculator was not used
or changed.

## Retained Recovery Artifacts

The exact development PostgreSQL container was verified by name, development
checkout label and port 5435 binding before backup and clone cleanup:
`business-management-system-dev-db-1` (`64d3332ee3fc`, PostgreSQL 16.14).

Private recovery directory, outside the repository:

```text
/home/ron/business-management-system-data-dev/backup/supplier-credit-recovery-20261026T055403Z
```

- Full custom-format dump: `development-before-supplier-credit.dump`.
- Size: 53,526,171 bytes. Archive listing and actual restore both passed.
- SHA-256: `71ebc2b8698cb275dfa57c0a596b613e3ab3cf014d0da9b925338ed150bce079`.
- `recovery-manifest.json` records fingerprints, original history, migration
  checksum, rehearsal, development/HTTP verification and clone cleanup.
- `history-recovery-analysis.json` records missing names/checksums and local/Git
  search evidence; `blank-checksum-investigation.json` contains catalog checks.
- `history-reconciliation-clone-deploy.log` records the final no-op rehearsal.
- Directory permissions are 0700; dump and verification artifacts are 0600.
  Credentials and temporary authentication tokens were not printed or persisted.

The earlier UI backup's JSON/CSV/XLSX exports omitted Products while its schema
was unavailable. Do not describe those exports as complete. The new verified
full dump above is the recovery artifact used for this operation. A preexisting
missing `clothing_accounting_opening_balances` table reported by that earlier
backup was not silently created or treated as resolved.

## Rehearsal And Development Verification

The dump was restored into task-created database
`bms_supplier_rehearsal_20261026055538_5f28e1` on development PostgreSQL, not the
existing port-5433 test database. Before migration, all 126 existing business/audit
table fingerprints and historical migration records matched the snapshot.

Prisma 5.22 `migrate deploy` applied only
`20261026120000_clothing_supplier_credits` on the clone. Original table contents
and history were unchanged. After that passed, the same SQL and backup hashes
were rechecked and the migration was applied to development at 06:03 UTC.

| Verification                                       | Actual result                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Existing non-audit business tables                 | All 125 fingerprints unchanged. Product comparison excludes only the three newly added supplier fields.                     |
| Original audit history                             | All 1,392,527 original rows unchanged, using the restored-copy snapshot cutoff.                                             |
| Concurrent audit activity                          | 138 new audit rows by final migration verification; append-only scheduled activity was distinguished from original history. |
| Historical migration records                       | Unchanged; only the new supplier migration was added.                                                                       |
| Pending/failed migrations                          | None pending locally; none failed. Missing historical files and blank checksums remain separate issues.                     |
| Product defaults                                   | 240 active products readable; supplier reference null, status ACTIVE, applied amount zero.                                  |
| New supplier tables                                | Credits 0, applications 0, transfers 0.                                                                                     |
| Authenticated GET `/api/products`                  | HTTP 200, 240 products.                                                                                                     |
| Authenticated GET `/api/products/supplier-credits` | HTTP 200, empty list.                                                                                                       |

The app middleware audits successful reads as well as writes. A strict pre-apply
fingerprint check stopped on new audit entries; investigation confirmed all
original audit IDs/content were unchanged and the new entries were scheduler
checks. Verification therefore kept original audit content strict while allowing
genuine later append-only audit records. No audit code or expectations changed.

HTTP verification at 06:05 UTC used normal NextAuth validation with a short-lived,
in-memory administrator token and GETs only; no auth bypass or permission changes.
The app remains at `http://localhost:5001`.

## Verified Historical File Recovery

These are source-history restorations, not new business policies or permission
to replay already-applied SQL against development.

The following two files were restored from exact originals in Git commit
`cba257e41f81`. Their SHA-256 hashes match the successful development records:

| Migration                                             | Applied/restored SHA-256                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `20251210103000_add_vehicle_id_to_trucking_expenses`  | `48007b63c65cccd6ed86812ede4265985e4112713e81d618dac09f5bc26bdd1d` |
| `20251210160000_add_transactions_and_product_columns` | `585011dd9265c87641e34db25cbeff1c3e558cc3f2440938a6f83dc66c584435` |

Later commits `fcddaeaf` and `e7448d76` had wrapped those applied files in
table-existence guards. Restoring original bytes removes those retrospective
edits; it does not establish fresh-database bootstrap safety.

One of the 44 missing migration names,
`20251024125453_add_foreign_keys_and_unique_constraints`, has the exact stored
checksum of the existing `20251021115334_add_thirteenth_month_pay_records` SQL.
That byte-identical content was recovered under the missing name and checked
against its successful record. Despite its name, it creates the thirteenth-month
pay table; this mismatch and duplicate DDL are preserved, not reinterpreted as
foreign-key policy or rewritten. A narrow SQL ignore exception tracks this file.

After these restorations, another Prisma deployment on the restored clone
reported no pending migrations, executed none, and left every migration-history
row unchanged. No historical SQL was replayed on development. The clone was then
dropped without forcing sessions, and its absence and development's continued
presence were verified at 06:12 UTC. The full backup is retained.

## Blank-Checksum Investigation

These are empty stored checksums, not four proven edited SQL files:

| Migration                                             | Recorded start and finish, both equal | Available SQL versions                      |
| ----------------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| `20260411120000_add_cash_advance_soft_delete_columns` | 2026-04-10 16:33:00.496 UTC           | One Git version, matching the current file. |
| `20260411130000_fix_remaining_schema_drift`           | 2026-04-10 16:56:19.144 UTC           | One Git version, matching the current file. |

Both records have `applied_steps_count = 1`, null logs and no rollback. Read-only
catalog checks matched all 26 declared columns' types, nullability and defaults,
and all 17 indexes' ordered columns, uniqueness, primary-key status, validity and
absence of predicates. This includes the GM calculator-state table's existing
schema only; no calculator logic/data was used or changed.

The matching schema does not prove which SQL created it or who registered the
history. Neither blank checksum was replaced. Any future metadata correction
needs independently established provenance and a separately reviewed plan.

## Final Validation

| Check                                     | Result for this operational/history batch                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Restored/recovered historical SQL hashes  | Exact applied-checksum matches; recovered file is not ignored.                                                             |
| Restored-copy migration rehearsal         | Only supplier migration applied; later deploy after history restoration was a no-op with unchanged metadata.               |
| Development and authenticated HTTP checks | Passed as recorded above; no business write requests were used for verification.                                           |
| `npm run lint`                            | Passed; existing unrelated warnings remain.                                                                                |
| `npm run typecheck`                       | Passed.                                                                                                                    |
| `node scripts/check-doc-command-drift.js` | Passed.                                                                                                                    |
| `npm run guardrails:check`                | Blocked by unchanged SUMMARIZE at 20,716 lines, including its hard-stop threshold. No override or unrelated decomposition. |

Only generated LIV-1 date churn from the guardrail run was removed, preserving
the pre-run document bytes. No TypeScript/business behavior changed in this
history-recovery batch. Full unit, integration, hardening and browser suites were
not rerun here; the separate supplier implementation results remain in section
12.4 of the accounting review. No default database-reset test setup was run.

## Unavailable Historical Originals

Search covered 46 local SQL files under Prisma/archives and all 53 SQL blobs
reachable through local Git refs, including renamed paths. No exact stored-hash
matches for the following 43 successful migration names were found. No SQL was
invented from the current schema, and no external or production source was read.

```text
20251026172801_add_performance_indexes
20251026173240_remove_composite_indexes
20251027045317_add_composite_indexes_for_query_optimization
20251030185535_add_checkout_links_table
20251030190435_make_product_names_nullable
20251031050849_add_additional_customer_info
20251031070300_add_dispatch_orders
20251101084132_add_salary_history_table
20251104131326_add_break_times_to_schedules
20251104140400_add_break_fields_to_schedule
20251105093000_add_operations_notifications
20251108_add_item_weights_table
20251108152430_add_item_weight
20251111094500_shipping_fee_calculator_state
20251112091500_add_change_log_table
20251115120000_add_transactions_readonly_toggles
20251121120000_add_post_template_notice
20251125093000_create_trucking_tables
20251203121500_add_scheduler_tables
20251209090000_rename_fleet_vehicles
20251216_add_trucking_trips_table
20251217090000_add_trucking_vehicle_assignments
20260106120000_reconcile_trucking_additive
20260108090000_add_transaction_status_changes
20260113_baseline_inventory
20260113142212_add_inventory_sold_bucket
20260114120000_add_reserved_and_assembly_wip_buckets
20260114153000_add_transaction_refund_fields
20260114160000_create_transaction_payments_table
20260114190000_create_transaction_refunds_table
20260114194500_create_clothing_inventory_reclass_entries
20260114210000_create_clothing_inventory_transit_build_entries
20260118120000_add_supplier_short_bucket
20260123120000_add_opening_inventory_bucket
20260126090000_add_gm_invoices_item_weights
20260126120000_add_gm_accounting_tables
20260202090000_add_gm_post_template_notice
20260202091500_add_gm_message_templates
20260127123000_add_gm_inventory_transit_build_entries
20260127180000_add_gm_inventory_reclass_and_expenses
20260128120000_add_gm_transaction_payment_reservation_flag
20260128130000_add_transaction_payment_reservation_flag
20260201093000_rename_base_price_to_landed_unit_cost
```

Completing reconciliation requires authentic originals from an approved archival
source, or a separately designed and approved baseline strategy. A schema dump
or guessed replacement is not historical recovery. Fresh-database replay is not
certified by these operations. The missing originals, two blank-checksum records,
broader A01-A12 findings and actual cash/card/bank reconciliation remain open.

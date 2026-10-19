# General Merchandise Product Identity Audit

**Audit date:** 2026-10-20  
**Database:** Development database (`business_management` on localhost:5435)  
**Audit:** Read-only, before and after the GM identity migration

## Results

There were 26 active products (30 total) and no duplicate active product codes. Every populated GM record in the identity scope had exactly one active product-code match before migration. The additive migration linked those records by `productId`; it did not need to guess among candidates.

| Record type               | Before: unique-code candidates | After: linked | After: unlinked |
| ------------------------- | -----------------------------: | ------------: | --------------: |
| Prices                    |                             26 |            26 |               0 |
| Transactions              |                             79 |            79 |               0 |
| Inventory movements       |                            159 |           159 |               0 |
| Sorting distributions     |                              0 |             0 |               0 |
| Bundle batch components   |                              0 |             0 |               0 |
| Inventory reclass entries |                              0 |             0 |               0 |
| **Total**                 |                        **264** |       **264** |           **0** |

No ambiguous, unmatched, or blank product-code records were found in these tables at audit time. Re-run the read-only audit with `npx tsx scripts/audit-general-merchandise-product-identity.ts` to inspect future data or verify another database.

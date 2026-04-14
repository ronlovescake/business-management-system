# Clothing — Prices Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/prices/services/PriceService.ts`
> - `src/modules/clothing/operations/prices/components/PricesPage.tsx`
> - `src/modules/clothing/operations/prices/hooks/usePriceForm.ts`
> - `src/app/api/split-batches/route.ts`

---

## A — Page Layout & Entry Points

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | The Prices page still renders the pricing grid plus Add/Edit modal flows | Search, stats cards, CSV import, and grid editing remain the main operator workflow. |
| 2 | Double-clicking a Product Code cell still opens the edit modal | Edit opens on the Product Code column only. |
| 3 | Add/Edit forms still manage up to 4 pricing tiers | Lower/upper limits and tier validation behavior are unchanged. |

---

## B — Which Product Codes Can Be Priced

| # | Logic | Explanation |
| --- | --- | --- |
| 4 | The Add Price product-code dropdown now includes standard products, bundles, mix-and-match SKUs, and split-child SKUs | Split-child codes are treated as valid pricing targets even without product-table placeholders. |
| 5 | Existing price rows still suppress duplicate Add Price options | The dropdown only offers codes that do not already have a stored price tier entry. |
| 6 | Split-child SKUs do not require auto-created `Price` rows to be usable in transactions | Their effective price can be derived from split batch data. |

---

## C — Actual Price Resolution Order

| # | Logic | Explanation |
| --- | --- | --- |
| 7 | Effective price lookup is composite-aware | The page resolves an actual price across multiple SKU types before opening/editing tiers. |
| 8 | Split-child `componentPrice` has the highest precedence | If a split component defines a price, that value is used first. |
| 9 | Fallback order is: split component price → product actual price → bundle price → mix-and-match price | This is the current runtime resolution order used by the Prices page and form hook. |
| 10 | If no valid positive price can be resolved, the UI leaves the tier price empty | Missing composite pricing does not fabricate a price. |

---

## D — Add / Edit Modal Behavior

| # | Logic | Explanation |
| --- | --- | --- |
| 11 | Tier prices are auto-filled from the resolved effective price source | Standard products still use actual price; split children can now use split component price. |
| 12 | Opening Edit still pre-fills the existing saved tiers, then re-syncs their prices from the effective price source | Edit mode preserves stored tier structure while refreshing the price baseline. |
| 13 | Clearing a tier lower limit still zeroes the dependent upper limit and price | This behavior is unchanged. |
| 14 | Submit remains blocked when tier ordering or required values are invalid | Validation rules are unchanged even though more SKU types are eligible. |

---

## E — Validation Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 15 | At least one tier is required | Empty tier sets are rejected. |
| 16 | Lower and upper limits must be positive and ordered correctly | `lowerLimit < upperLimit` remains required per tier. |
| 17 | Tiers must remain strictly ascending by lower limit | Overlapping or unordered tiers are invalid. |
| 18 | Only populated tiers are exported to storage | Placeholder rows are filtered out before persistence. |

---

## F — CSV Import & Statistics

| # | Logic | Explanation |
| --- | --- | --- |
| 19 | CSV import still replaces the live price dataset rather than merging | Import remains a full replace workflow. |
| 20 | Statistics cards still summarize stored price-tier records, not virtual split definitions | Split component prices influence form defaults, but the stats view is still based on persisted price records. |

---

## G — Split Workflow Note

Split pricing now behaves like a composite workflow:

- operators maintain child piece pricing in the Split tab via `componentPrice`
- the Prices page can still create explicit tier rows for split-child SKUs if
	needed
- transactions can use split-child SKUs even when there is no auto-created
	product row and no auto-created price row

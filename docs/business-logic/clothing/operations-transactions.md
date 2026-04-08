# Clothing — Transactions Business Logic

> **Source files:**
>
> - `src/modules/transactions/api/service.ts`
> - `src/modules/transactions/api/service-calculations.ts`
> - `src/modules/transactions/api/sanitizers.ts`
> - `src/modules/transactions/api/schemas.ts`
> - `src/modules/transactions/api/createInputHelpers.ts`
> - `src/modules/clothing/operations/transactions/hooks/` (all hook files)

---

## A — Data Validation & Import Rules

| #   | Logic                                            | Explanation                                                                                                                                                               |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Customer name is required on import              | Every imported transaction row must have a non-empty `Customers` field or the row is rejected with an error.                                                              |
| 2   | Product code is required on import               | Every imported row must include a valid `Product Code`; blank product codes are rejected.                                                                                 |
| 3   | Quantity must be a positive number               | Quantity values ≤ 0 (after parsing) are rejected during import.                                                                                                           |
| 4   | Unit price can be zero (auto-fill applies)       | A zero unit price is not an error; the import pipeline and `buildCreateInput` will attempt to auto-fill from price tiers.                                                 |
| 5   | Order Status defaults to null if not supplied    | If Order Status is missing in an import row, the field is saved as null rather than failing validation.                                                                   |
| 6   | Numeric fields are sanitized before validation   | `sanitizeTransactionRecord` strips currency symbols, commas, and whitespace from all numeric columns (Unit Price, Discount, Adjustment, etc.) before Zod validation runs. |
| 7   | String fields are trimmed                        | `parseTrimmed` is applied to all string columns, preventing whitespace-only values from passing as real data.                                                             |
| 8   | Optional fields become null, not empty string    | `parseOptional` converts blank string values to `null` so the database never stores empty strings in optional columns.                                                    |
| 9   | Zod schema validates shape after sanitization    | `transactionDataSchema` and `transactionArraySchema` are the final gate; rows failing schema validation accumulate in the error list returned to the caller.              |
| 10  | Import errors are returned per-row, not fail-all | Errors are collected per-row and returned in the response; valid rows are still imported even when some rows fail.                                                        |

---

## B — Pricing & Line Total Rules

| #   | Logic                                                  | Explanation                                                                                                                                                       |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | Unit price auto-fill from price tiers                  | When `buildCreateInput` receives a unit price of 0, it looks up the product's price tier by quantity range and substitutes the tier price before saving.          |
| 12  | Line total auto-calculation when zero                  | When line total is 0 at create time, it is computed as `(Unit Price × Qty) − Discount − Adjustment` and stored.                                                   |
| 13  | Stored line total takes precedence on update           | `computeLineTotalForUpdate` uses the stored `lineTotal` (already net of discount) as the base; it does not recompute from unit price unless explicitly triggered. |
| 14  | Remaining balance = Line Total − Payments received     | `computeRemainingBalance` subtracts confirmed payment totals from the stored line total to derive the outstanding amount.                                         |
| 15  | `isPaidStatus` determines payment completion           | A transaction is considered fully paid only when its order status matches one of the configured paid statuses (e.g., "Checked Out").                              |
| 16  | Discount is capped by the line total                   | There is no explicit cap in code, but downstream accounting logic treats the net amount as max(0, lineTotal − discount).                                          |
| 17  | Unit price recalculates on cell edit (UI)              | When users edit Unit Price in the grid, `transactionComputedColumnHandlers` re-derives Discount and Line Total for the affected row.                              |
| 18  | Line Total recalculates after discount or price change | Editing Discount or Unit Price in the inline grid triggers an immediate Line Total update without requiring a save.                                               |

---

## C — Order Status Business Rules

| #   | Logic                                                      | Explanation                                                                                                                                                 |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | Paid status can only be set on non-voided transactions     | `assertCanSetPaidStatus` throws if the transaction is already Voided, preventing paid status on cancelled records.                                          |
| 20  | Order status cannot regress to In-Transit                  | `assertOrderStatusNotBackwardToInTransit` blocks any update that would move status back to "In Transit" once it has advanced past that stage.               |
| 21  | Voided status triggers a refund reminder dialog            | Changing order status to "Voided" triggers a SweetAlert2 confirmation asking operators to check whether a refund is needed.                                 |
| 22  | Shipment status auto-resolves on transaction status change | `resolveLinkedShipmentStatus` checks if the linked shipment's status needs to advance (e.g., to Delivered) after the transaction reaches a terminal status. |
| 23  | Paid status guard runs before persisting updates           | The service validates paid-status rules before any DB write; partial updates are not written if the guard fails.                                            |
| 24  | Mix-and-match status advances independently                | Mix-and-match transaction lines track their own order status and are not merged with the parent order for status resolution.                                |

---

## D — Inventory Movement Sync

| #   | Logic                                                       | Explanation                                                                                                                                               |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Inventory movements are synced on every transaction save    | `syncInventoryMovementsForTransaction` is called after every create and update to keep the inventory ledger in sync with the transaction record.          |
| 26  | Only non-cancelled transactions affect inventory            | Cancelled/voided order statuses are excluded from inventory commitment so stock is not tied up for cancelled orders.                                      |
| 27  | Committed quantity tracks reserved (not yet shipped) demand | All non-terminal, non-cancelled order statuses (e.g., Warehouse, Prepared) count as committed, reducing available stock.                                  |
| 28  | Sold quantity tracks fulfilled (dispatched) demand          | "Ready For Dispatch", "Checked Out", and "Shipped" statuses move quantity from committed to sold.                                                         |
| 29  | Inventory movements use product code as the key             | All movement records are keyed on the normalized product code to handle case and whitespace inconsistencies.                                              |
| 30  | Mix-and-match transactions reserve component product stock  | MnM batch lines consume inventory from the component SKUs, not the virtual mix SKU.                                                                       |
| 31  | Bundle transactions consume discrete product quantities     | Bundle batch items are traced to their component product codes, and each component's inventory is decremented.                                            |
| 32  | Damage bucket tracks hold stock separately                  | `damagedDeltaByProduct` maintains a separate count of units moved into the `damaged_hold` bucket, which reduces sellable availability.                    |
| 33  | Scrap write-offs are one-directional                        | Movements into the `scrap` bucket are counted as losses; movements from `scrap` to `sellable` (reverse receipts) are tracked with a separate note marker. |
| 34  | Additionals (extra stock received) use note prefix          | Movements with a note starting with "additionals" are processed as stock additions, increasing the sellable baseline.                                     |
| 35  | Transfer movements use a separate note prefix               | Movements between product codes have a "transfer" note prefix, and transfer-sellable-delta is computed separately from standard adjustments.              |

---

## E — Bulk Update Safety

| #   | Logic                                                | Explanation                                                                                                                                               |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 36  | Bulk update validates each row before committing     | Each row in `bulkUpdateTransactions` is sanitized and validated individually; rows failing validation are collected in errors but do not abort the batch. |
| 37  | Bulk updates run per-row inventory sync              | Each successfully updated transaction in a bulk operation triggers its own inventory movement sync.                                                       |
| 38  | Paid-status guard applies per-row in bulk            | The `assertCanSetPaidStatus` check runs for each row individually in bulk mode, so one Voided row failure does not block the other rows.                  |
| 39  | Bulk update returns a row-level success/error report | The response includes counts of successes and failures with per-row error messages for traceability.                                                      |

---

## F — Soft Delete

| #   | Logic                                                        | Explanation                                                                                                         |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 40  | Transactions are soft-deleted, not hard-deleted              | `softDeleteAll` sets `deletedAt` timestamp rather than physically removing rows, preserving history for accounting. |
| 41  | Soft-deleted transactions are excluded from all live queries | All service queries filter `deletedAt: null` to ensure deleted rows do not appear in reports or picks.              |

---

## G — Draft Row Creation (UI)

| #   | Logic                                                 | Explanation                                                                                                                      |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 42  | A new draft row requires minimum fields before saving | `hasMinimumCreateFields` checks that at least Customer and Product Code are set before allowing an inline save.                  |
| 43  | In-flight draft creation is deduplicated              | `transactionDraftCreation` tracks a `pendingCreate` flag; a second save on the same draft is blocked until the first resolves.   |
| 44  | Optimistic cache update on draft save                 | After a successful create, the React Query cache for the transactions list is immediately updated without waiting for a refetch. |
| 45  | Draft date defaults to today in Manila timezone       | `formatTodayInManila` uses `Asia/Manila` as the reference timezone when auto-populating the Date column.                         |
| 46  | Draft row is cleared after successful save            | On successful API response, the draft row is removed from local state and replaced with the server-returned record.              |

---

## H — Stock Check Logic (UI)

| #   | Logic                                                                                  | Explanation                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 47  | Stock check triggers when a product code is selected or quantity is increased          | `transactionQuantityColumnHandler` fires a POST to `/api/clothing/check-stock` whenever the product code dropdown changes or the new quantity is larger than the currently stored value.                                                                                                                                                                                                      |
| 48  | **SOLD_OUT** → SweetAlert2 error blocks order creation                                 | If `stockInfo.status === 'SOLD_OUT'`, a red SweetAlert2 is shown: title "🔴 Insufficient Quantity!", text from `stockInfo.message`, red confirm button (`#fa5252`), `allowOutsideClick: false`. The save is **blocked** — `return` prevents any further processing.                                                                                                                         |
| 49  | **INSUFFICIENT_STOCK with available > 0** → SweetAlert2 warning offers to cap quantity | If `stockInfo.status === 'INSUFFICIENT_STOCK'` and `availableStock > 0`, a warning SweetAlert2 is shown: title "🔴 Insufficient Quantity!", text "{message}\n\nUse max available quantity ({N}) to sell out?", confirm button "Use {N}", cancel button "Cancel", yellow confirm (`#fab005`). If confirmed, quantity is auto-updated to the available amount. If cancelled, save is **blocked**. |
| 50  | **INSUFFICIENT_STOCK with available = 0** → SweetAlert2 error blocks order creation    | If `availableStock === 0` on a `INSUFFICIENT_STOCK` response, a blocking red SweetAlert2 is shown (same style as SOLD_OUT) and save is blocked.                                                                                                                                                                                                                                               |
| 51  | **LOW_STOCK** → SweetAlert2 warning shown but order proceeds                           | If `stockInfo.status === 'LOW_STOCK'`, a warning SweetAlert2 is shown: title "🟡 Low Stock Warning", text from `stockInfo.message`, yellow confirm button (`#fab005`). Clicking OK allows the order to continue — **save is not blocked**.                                                                                                                                                  |
| 52  | Stock check failure is logged and treated as safe-pass                                 | If the fetch itself throws an error, it is logged via `logger.error` and execution continues. A failed stock check does not block the order.                                                                                                                                                                                                                                                  |
| 53  | Stock check uses POST `/api/clothing/check-stock`                                      | Request body: `{ productCode, requestedQuantity }`. The endpoint enforces domain boundaries and uses the Clothing Prisma binding.                                                                                                                                                                                                                                                             |
| 54  | Bundle stock check aggregates component availability                                   | When a bundle SKU is entered, the check-stock endpoint resolves minimum available across all component SKUs.                                                                                                                                                                                                                                                                                  |
| 55  | Mix-and-match stock check evaluates the most constrained component                     | The available quantity for an MnM set is determined by the component with the least available stock relative to its demand ratio.                                                                                                                                                                                                                                                             |

---

## I — Invoice & Document Generation

| #   | Logic                                                             | Explanation                                                                                                                              |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 56  | Invoice type is selected before PDF generation                    | `useInvoiceGeneration` prompts with a SweetAlert2 picker: On-Hand, In Transit, Reservation 10%, or Reservation 20%.                      |
| 57  | On-Hand invoice filters transactions by Warehouse/Prepared status | Only rows with "Warehouse" or "Prepared" order status are included in an On-Hand invoice.                                                |
| 58  | In-Transit invoice filters by In-Transit status                   | Only rows with "In Transit" order status are included in an In-Transit type invoice.                                                     |
| 59  | Reservation invoices apply a percentage of total                  | Reservation 10% and 20% invoice modes multiply the line total by the stated percentage to produce a partial-payment invoice amount.      |
| 60  | Distribution slip generation filters by Warehouse/Prepared        | `useDistributionGeneration` sends only "Warehouse" and "Prepared" status rows to the distribution PDF endpoint.                          |
| 61  | PDF is generated server-side and downloaded as a blob             | Both invoice and distribution APIs return a binary PDF; the front-end triggers a download via a programmatically created anchor element. |
| 62  | Invoice PDF includes a configurable message template              | The system loads an invoice message template from the settings API and injects it into the generated PDF.                                |
| 63  | Facebook link is included when available                          | If the customer has a Facebook URL, it is appended to the invoice for social proof and follow-up.                                        |

---

## J — Due Date Tracking (UI)

| #   | Logic                                            | Explanation                                                                                                     |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 64  | Due date view shows transactions grouped by date | `useTransactionsDerivedData` builds a "due dates" tab view that groups transactions by their due date column.   |
| 65  | Due date filter supports multi-select toggle     | `useDueDateFilters` maintains a Set of active date filters; toggling a date adds or removes it from the filter. |
| 66  | "Show All" is preserved as an invariant          | The "Show All" option is always kept in the filter panel regardless of which individual dates are toggled.      |
| 67  | Overdue transactions are visually flagged        | Rows where due date has passed and status is not completed are surfaced with a distinct color or badge.         |

---

## K — Payments (Modal)

| #   | Logic                                                  | Explanation                                                                                                                              |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 68  | Payment draft is built from current remaining balance  | `transactionPaymentsHelpers` initialises the payment draft amount to `computeRemainingBalance(transaction)`.                             |
| 69  | Bulk payment payload assembles per-transaction amounts | When multiple transactions share a customer, the bulk payment API call batches all outstanding line amounts into a single request.       |
| 70  | Payments are attributed to the active operator         | The session user name is written as the `createdBy` field on new payment records.                                                        |
| 71  | Payment saves trigger a live balance update            | After a successful payment POST, the React Query cache for the affected transaction is invalidated to reflect the new remaining balance. |
| 72  | Over-payment is allowed                                | There is no server-side cap that prevents a payment exceeding the line total; the business records the over-payment as a credit.         |

---

## L — Customer Warning State

| #   | Logic                                          | Explanation                                                                                                                                                                            |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 73  | Customers with delinquent balances are flagged | The customer badge logic in `useTransactionsDerivedData` checks for non-zero remaining balance on aged (past-due) transactions and applies a warning indicator to the customer's name. |

---

## M — Miscellaneous

| #   | Logic                                                       | Explanation                                                                                                                                                        |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 74  | Packing list view groups transactions by product code       | A dedicated "Packing List" view in `useTransactionsDerivedData` pivots the transaction data by product code with per-status quantity subtotals.                    |
| 75  | Recently-updated view surfaces the last 50 changed rows     | The "Recently Updated" tab filters for records changed in the past 24 hours, ordered by `updatedAt` descending, limited to 50.                                     |
| 76  | All date operations use Manila timezone                     | Date comparisons, display formatting, and defaults throughout the hook layer normalise to `Asia/Manila` to avoid off-by-one-day issues for Philippines operations. |
| 77  | Column headers are configurable per-view                    | `useTransactionsDerivedData` builds column definitions for different views (standard, packing, due dates) with different column sets and pinning configurations.   |
| 78  | Product code normalisation strips whitespace and lowercases | `normalizeProductCode` trims and lowercases the string before any lookup or comparison, ensuring "KTS-001 " and "kts-001" resolve to the same product.             |
| 79  | Inventory movements use idempotency on sync                 | `syncInventoryMovementsForTransaction` checks for an existing movement record for the same (transactionId, bucket, type) combination before creating a new one.    |
| 80  | Transaction soft-delete hides linked payments from live workflows without explicitly soft-deleting the payment rows | `softDeleteAll` marks transaction rows with `deletedAt`; downstream payment/accounting readers also filter out payments whose parent transaction is soft-deleted, but this service does not directly mark `transaction_payments.deletedAt`. |

---

## N — Invoice Route Family

| #   | Logic                                                                                                   | Explanation                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 81  | Clothing invoice CRUD lives under `/api/invoices`                                                       | The shared invoice route family backs the clothing invoice table with one base route namespace.                                                                                                                                                        |
| 82  | `GET /api/invoices` returns live invoices ordered newest first                                          | The route filters on `deletedAt: null` and orders results by `createdAt` descending.                                                                                                                                                                   |
| 83  | `POST /api/invoices` bulk-replaces the live invoice set                                                 | The route validates an `invoices` array, soft-deletes existing live rows by setting `deletedAt`, then inserts the replacement set via `createMany`.                                                                                                    |
| 84  | `PUT /api/invoices` updates one invoice by `id`; `DELETE /api/invoices?id=...` soft-deletes one invoice | The update route persists the invoice fields for a single record, while DELETE marks one invoice as deleted without hard-deleting it.                                                                                                                  |
| 85  | Related invoice subroutes stay in the same family                                                       | `GET /api/invoices/customer-orders`, `GET/POST /api/invoices/calculate-weights`, and `PUT /api/invoices/{id}/tickbox` are part of the same family; detailed tickbox and calculate-weights operator behavior remains documented in checkout-links docs. |

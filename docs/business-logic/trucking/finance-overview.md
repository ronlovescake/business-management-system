# Trucking — Finance Overview

> **Source files:**
>
> - `src/app/trucking/invoices/page.tsx`
> - `src/app/api/trucking/invoices/route.ts`
> - `src/app/api/trucking/invoices/generate/route.ts`
> - `src/app/trucking/payments/page.tsx`
> - `src/app/api/trucking/payments/route.ts`
> - `src/app/trucking/expenses/page.tsx`
> - `src/app/api/trucking/expenses/route.ts`
> - `src/modules/trucking/employees/expenses/api/**`
> - `src/app/api/trucking/payroll/route.ts`
>
> **Related reporting docs:** `analytics-profitability.md`, `reports-cashflow.md`

---

## A — Invoice Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | Trucking invoices are customer-and-cutoff billing records | The invoice model is keyed around one customer over one cutoff window rather than around a single trip. |
| 2 | Only completed, unbilled trips are eligible for invoice generation | The generator filters to trips where `status='completed'` and `invoiceId=null` within the requested cutoff window. |
| 3 | Invoice totals are calculated from trip revenue, not manually keyed arbitrarily | `totalAmount` is the sum of `grossRevenue` across the eligible trips in the cutoff set. |
| 4 | One customer can only have one invoice per cutoff window | The unique constraint on `(customerId, cutoffStart, cutoffEnd)` prevents duplicate period billing. |
| 5 | Invoice generation links each included trip back to the created invoice | Trips stop being invoice candidates once they have an `invoiceId`. |
| 6 | Invoice generation fails fast when nothing is billable | The generator returns a not-found response when no trips match the customer and date criteria. |
| 7 | Trucking invoice statuses are `DRAFT`, `SENT`, `PARTIAL`, `PAID`, and `VOID` | The invoice status model supports pre-send, partially settled, fully settled, and voided states. |
| 8 | Re-running generation on the same trip set is effectively idempotent for already-linked trips | The generator only considers trips with `invoiceId=null`, so already billed trips are excluded from duplicate linking. |

---

## B — Payment And Allocation Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 9 | Trucking payments are customer receipts that may be allocated across invoices | A payment belongs to a customer and can distribute value to one or more invoices. |
| 10 | Payment methods are constrained to the trucking payment enum | Supported methods are `CASH`, `BANK`, `GCASH`, `CHECK`, and `OTHER`. |
| 11 | Total allocations may not exceed the payment amount | The payments API validates the sum of allocations before the payment is accepted. |
| 12 | Each invoice allocation may not exceed that invoice's remaining balance | Allocation validation subtracts prior payments and prevents over-settling an invoice. |
| 13 | Updating a payment replaces its allocation set atomically | The current update flow deletes existing allocations and recreates the submitted allocation set in one logical replacement pass. |
| 14 | Bulk payment creation is supported | The API accepts arrays of payments with embedded allocations for higher-volume operator workflows. |

---

## C — Trucking Expense Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 15 | Trucking expenses are a distinct finance dataset from trip header fields | Expenses live in their own table and carry workflow status, source tracking, and optional employee or vehicle linkage. |
| 16 | Expense statuses are `pending`, `approved`, `rejected`, and `paid` | The trucking expense workflow supports review and settlement states rather than only a single posted state. |
| 17 | Status defaults to `pending` at the data-model level | Manual expenses enter the workflow as pending unless another workflow sets a different status. |
| 18 | Expense source tracking is first-class | `sourceType`, `sourceId`, and `sourceLineKey` let the system distinguish manual entries from trip-, payroll-, or other generated costs. |
| 19 | `systemGenerated` separates automatic rows from manual operator entries | This matters for payroll-derived and other system-originated expense records. |
| 20 | Vehicle-linked expense IDs are normalized to uppercase | The service layer normalizes vehicle references for consistency with trucking identifiers. |
| 21 | Trucking expenses are soft-deletable | The model preserves deleted rows through `deletedAt` rather than using immediate hard delete semantics. |
| 22 | Payroll can post trucking expenses automatically | Trucking payroll creates expense rows such as driver-pay entries through source-linked payroll posting logic. |
| 23 | Trucking expense categories are fixed-enum operational buckets | Categories include Driver Pay, Fuel, Helper Pay, Load/Unload Fees, Maintenance & Repairs, Misc, Meal, Parking Fees, Toll Fees, Transportation, Truck Washing / Cleaning, Permits & Registration, and Vehicle Purchase. |

---

## D — Cross-Module Interpretation Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 24 | Profitability reporting uses only `sourceType='TRIP'` expense rows linked to the trip | The profitability API groups expenses by `sourceType='TRIP'` and `sourceId=tripId`, so payroll-posted `PAYROLL` rows such as Driver Pay are outside the current report. |
| 25 | Trip finalization can materialize trip-side cost fields into finance-side expense rows | The finalize workflow writes system-generated trucking expense rows for trip cost lines such as fuel, maintenance, toll, and misc; maintainers should not assume other workflows follow the same mirroring rule unless documented. |
| 26 | Cashflow reporting interprets payments as inflows and expenses as outflows | The current trucking cashflow view is cash-movement oriented rather than invoice-accrual oriented. |
| 27 | Trucking finance is intentionally decoupled from clothing and general-merchandise finance rules | Similar concepts exist across domains, but trucking owns its own entities, validations, and report semantics. |
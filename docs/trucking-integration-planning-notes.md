# Trucking Integration Planning Notes (Trips ↔ Expenses ↔ Payroll ↔ Attendance ↔ Billing/Payments)

## Goal

Make the trucking webapp work seamlessly with other business modules by:

- **Automatically posting** operational events (Trips, Payroll) into a shared **Expenses ledger**
- Tracking **cash received from clients** (Payments) in a clean AR flow (Invoices → Payments)
- Keeping data **consistent, traceable, and non-duplicated**

---

## Core Principles / Guardrails

### 1) Separate sources of truth

- **Operational truth**: Trips, Vehicle Assignments, Attendance, Payroll Runs
- **Billing truth (AR)**: Invoices (what you billed)
- **Cash truth**: Payments (what you actually collected)
- **Financial postings**: Expenses entries (company spending ledger)

### 2) Traceability (no “mystery” entries)

Every generated record should link back to its origin:

- `sourceType` (e.g., `TRIP`, `PAYROLL`, `MANUAL`, `INVOICE`, `PAYMENT`)
- `sourceId` (tripId, payrollRunId, invoiceId, paymentId, etc.)
- `sourceLineKey` (e.g., `fuel`, `tollFees`, `netPay:<employeeId>`)
- `systemGenerated` boolean

### 3) Idempotency (no duplicates)

When syncing/auto-posting, prevent duplicates with a uniqueness rule like:

- Unique constraint: `(sourceType, sourceId, sourceLineKey)`
- Use **upsert** or **void+recreate** when the source changes.

### 4) Clear edit/reversal policy (decide before rollout)

If a Trip/Payroll/Invoice changes after posting, choose one approach:

1. Regenerate linked lines (simple)
2. Post adjustment entries (best audit trail)
3. Lock after “finalized/paid” (strict control)

---

## Expenses Module (Company Spending Ledger)

### Current issue

Expenses table currently shows **Vehicle ID**, but not all expenses are vehicle-related (e.g., payroll).

### Recommended resolution

- Keep **Vehicle/Asset** as an **optional** dimension (nullable).
- Add a **Source** column in UI to show where an entry came from (Trip/Payroll/Manual/etc.).

### Proposed UI columns (high-level)

- DATE
- AMOUNT
- DESCRIPTION
- CATEGORY
- NOTES
- VEHICLE / ASSET (optional)
- SOURCE (Trip / Payroll / Manual / etc.)
- RECEIPT
- LOGGED BY
- ACTION

### Recommended DB fields (minimum for integrations)

- `vehicleId` (nullable)
- `sourceType` (string/enum; displayed as SOURCE in UI)
- `sourceId` (nullable string/uuid)
- `sourceLineKey` (nullable string)
- `systemGenerated` (boolean)

Optional future dimensions:

- `employeeId` (nullable) – for payroll/reimbursements
- `department` / `costCenter` (nullable)
- `vendorId` (nullable)

---

## Trips → Expenses Automation (Trip costs)

### Mapping idea (recommended: line-level per cost type)

For each Trip, post one expense per category for reporting clarity:

- `fuelCost` → category = `FUEL` (`sourceLineKey = "fuel"`)
- `tollFees` → category = `TOLL` (`sourceLineKey = "tollFees"`)
- `maintenance` → category = `MAINTENANCE & REPAIRS` (`sourceLineKey = "maintenance"`)
- `miscExpenses` → category = `MISC` (`sourceLineKey = "misc"`)

Expense fields:

- `vehicleId = trip.vehicleId`
- `sourceType = TRIP`
- `sourceId = tripId`
- `systemGenerated = true`

### Posting trigger (decision)

- Option: post on trip save
- Recommended: post on trip **finalize/approve** if edits are common

---

## Payroll → Expenses Automation (Payables paid)

### Pay schedule

- Everyone is paid on the **15th** and the **last day** of the month.

### Recommended structure

- One **Payroll Run** per pay date (e.g., Jan 15, Jan 31)
- Post to Expenses when payroll run is marked **Paid**

### Posting granularity (decision)

- Option A: 1 aggregated expense per payroll run (simpler)
- Option B: 1 expense per employee per payroll run (more traceable)

Expense fields:

- `vehicleId = NULL`
- `sourceType = PAYROLL`
- `sourceId = payrollRunId`
- `sourceLineKey = "total"` or `netPay:<employeeId>`
- `systemGenerated = true`

---

## Drivers/Helpers: Schedule, Attendance, Pay (avoid confusion)

### Payment reality

- Ops managers/utilities/supervisors: monthly salary (paid 15th/last day)
- Drivers/helpers: **per-trip** earnings but still paid 15th/last day

### Key concept

Attendance tracking and payroll calculation do **not** have to be identical:

- Monthly staff: payroll can remain attendance-based.
- Drivers/helpers: earnings should be **trip-based**; attendance is used for validation/adjustments.

---

## Vehicle Assignments as Driver/Helper “Schedules”

### Existing module

`/trucking/operations/vehicle-assignments` assigns driver/helper to a truck for a date range.

### Planned usage

Treat Vehicle Assignments as the **base roster** (expected crew), not a fixed daily shift.

For each trip:

1. Determine expected driver/helper from the truck’s assignment on that trip date.
2. Allow trip-level override:
   - `actualDriverId`, `actualHelperId` (reliever use)
   - reason/status: `RELIEVER_USED`, `NO_SHOW`, `LATE`, etc.

---

## Trips UI: Prefill crew from Vehicle Assignments + Reliever Override

### Prefill behavior (expected crew)

When logging a trip, once the user selects:

- `tripDate`
- `vehicleId`

Lookup active Vehicle Assignment where:

- `assignment.vehicleId === vehicleId`
- `assignment.startDate <= tripDate <= assignment.endDate`
- `assignment.status` is active/scheduled

Then prefill:

- `expectedDriverId` from assignment driver
- `expectedHelperId` from assignment helper (if any)

### Override behavior (actual crew / reliever)

Provide an explicit control such as:

- “Override crew (Reliever)” toggle, or
- “Driver/Helper absent” action

Default: override OFF

- Actual crew == expected crew

When override ON:

- Show **Expected Driver/Helper** read-only (from assignment)
- Enable **Actual Driver/Helper** dropdowns for relievers
- Require an override reason (Absent / Late / Emergency / etc.)

### Safety rule (prevent accidental drift)

If user changes Driver/Helper without enabling override:

- either block and prompt “Use Override to change crew”, **or**
- auto-enable override and set reason = “Manual override” (decision later)

---

## Attendance Policy for Drivers/Helpers (Trip-based)

### Event-based attendance

Attendance is attached to the **trip event** (or trip date), not a fixed shift template.

Statuses (example):

- `UNCONFIRMED`
- `PRESENT`
- `LATE`
- `ABSENT_NO_SHOW`
- `REPLACED_BY_RELIEVER`
- `TRIP_CANCELLED`

### “Neutral-until-confirmed” clarified

- Neutral-until-confirmed = NOT automatically present or absent
- Default status is `UNCONFIRMED` until dispatcher/supervisor confirms

---

## Client Billing + Cash Received (AR: Invoices + Payments)

### Requirement

Track **cash received from clients** (payments). Clients pay **batch per cutoff** (one payment can cover many trips).

### Why not store payments in Trips or Expenses

- Trip = earned revenue context (what you charged)
- Payment = cash receipt event (what you collected)
  They must be tracked separately to support partial payments, overpayments, and outstanding receivables.

### Minimal AR data model (recommended)

1. **Customers**

- A trip must be attributable to a customer to batch-bill correctly.

2. **Trips**
   Add/ensure:

- `customerId` (required for invoicing)
- `status` (`DRAFT|COMPLETED|CANCELLED`, etc.)
- optional: `completedAt`

3. **Invoices** (per customer per cutoff)
   Fields:

- `customerId`
- `cutoffStart`, `cutoffEnd`
- `invoiceDate`, `dueDate`
- `status` (`DRAFT|SENT|PARTIAL|PAID|VOID`)
- `totalAmount` (stored or computed)

4. **Link trips to invoices**
   Recommended simplest approach:

- `trips.invoiceId` nullable (many trips → one invoice)

5. **Payments**
   Fields:

- `customerId`
- `paymentDate`
- `amount`
- `method` (cash/bank/etc.), `referenceNo`, `notes`

6. **Payment Allocations**

- `(paymentId, invoiceId, amount)` to support partial/multi-invoice allocation.

### Cutoff Invoice generation (auto-include rule)

When creating an invoice for `customerId + cutoffStart/end`, auto-include trips where:

- `trip.customerId == invoice.customerId`
- `trip.tripDate between cutoffStart and cutoffEnd`
- `trip.status == COMPLETED`
- `trip.invoiceId is NULL` (not yet billed)

---

## Reporting / Screens (avoid duplicated “combined tables”)

### 1) Profitability view (earned revenue vs trip costs)

Read-only reporting view combining:

- Trips.grossRevenue (earned)
- Trip-linked expenses (fuel/toll/maintenance/misc)

### 2) Cashflow view (cash-in vs cash-out) — your priority

Read-only reporting view combining:

- **Cash In**: Payments received within date range
- **Cash Out**: Expenses within date range
  Optional:
- **Outstanding AR**: invoice totals minus allocated payments

> Prefer reporting views over storing a duplicated “combined” table to avoid mismatches.

---

## Open Decisions (confirm before implementation)

1. Trips → Expenses posting trigger:
   - On save vs on finalize/approve

2. Edit policy after posting:
   - Regenerate vs adjustment entries vs lock

3. Payroll → Expenses granularity:
   - Aggregated per run vs per employee

4. Crew override strictness:
   - Block change without override vs auto-enable override

5. Invoicing details:
   - Invoice numbering scheme, due dates, discounts/adjustments (line items vs header-only)

---

## Summary

- Expenses = spending ledger with `sourceType/sourceId` link fields; vehicle is optional.
- Trips post cost lines to Expenses; Payroll posts payout lines to Expenses.
- Vehicle Assignments are the roster; Trips prefill expected crew and allow reliever overrides.
- Attendance for drivers/helpers is trip-based and neutral-until-confirmed.
- Cash received requires AR: Cutoff Invoices + Payments + Allocations, plus reporting (cash-in vs cash-out).

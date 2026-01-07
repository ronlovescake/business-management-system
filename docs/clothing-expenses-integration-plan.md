# Clothing Expenses Integration Plan

## Scope

- Auto-post product costs into clothing employees expenses.
- Prepare groundwork for payroll-to-expenses posting.
- Preserve manual expense flow; add source tagging and idempotency.

## Data Model & Schema

- Ensure expense fields exist: `sourceType`, `sourceId`, `sourceLineKey`, `systemGenerated`.
- Add DB unique index on `(sourceType, sourceId, sourceLineKey)` for idempotency.
- Keep existing fields: `date`, `amount`, `description`, `category`, `notes`, `receipt`, `employeeName` (optional).
- Source type enum values to use: `PRODUCT`, `PAYROLL`, `MANUAL` (extend as needed).

## Mapping: Products → Expenses

- `date`: from Product `Order Date` (YYYY-MM-DD).
- `description`: from `Product Code` (optionally include product name suffix).
- `amount`: from `Grand Total` (parse numeric, handle commas).
- `category`: `Products`.
- `notes` (optional): product name or row context.
- `sourceType`: `PRODUCT`.
- `sourceId`: product row ID (or import/batch ID if no per-row ID available).
- `sourceLineKey`: stable per row (e.g., `product:<productCode>` or actual row primary key).
- `systemGenerated`: `true`.

## Mapping: Payroll → Expenses

- Option A (simpler): one expense per payroll run.
  - `date`: payroll pay date.
  - `description`: `Payroll Run <payDate>` (or run name/id).
  - `amount`: total net pay for the run.
  - `category`: `Payroll`.
  - `sourceType`: `PAYROLL`.
  - `sourceId`: payrollRunId.
  - `sourceLineKey`: `total`.
  - `systemGenerated`: `true`.
- Option B (more traceable): one expense per employee per run.
  - `date`: payroll pay date.
  - `description`: `Net pay — <employeeName>`.
  - `amount`: net pay for that employee.
  - `category`: `Payroll`.
  - `sourceType`: `PAYROLL`.
  - `sourceId`: payrollRunId.
  - `sourceLineKey`: `netPay:<employeeId>`.
  - `employeeId`: set when available.
  - `systemGenerated`: `true`.
- Notes: keep vehicleId null; keep receipt null; allow notes for pay period coverage.

## Posting Trigger & Behavior

- Products: trigger when row is finalized/accepted (avoid drafts) or on import with safe re-runs.
- Payroll: trigger when payroll run is marked paid (not on draft creation).
- Use upsert-by-source-key to avoid duplicates and allow reruns on the same rows.
- On source edits: regenerate expense lines (void+recreate via upsert), not adjustment entries (for now).

## API/Service Work

- Add repository/service upsert helpers keyed by `(sourceType, sourceId, sourceLineKey)`.
- Expose batch upsert endpoint/method for system postings.
- Update Zod schemas to allow system fields on system calls, default manual posts to `MANUAL` + `systemGenerated=false`.
- Ensure GET includes source fields in responses.

## UI/UX Updates (Expenses)

- Add `Source` column derived from `sourceType` (labels: Product, Payroll, Manual).
- Add `systemGenerated` badge/lock indicator; optionally block edits or warn when editing system-generated lines.
- Add filter by `Source`; keep category/status filters intact.

## Testing

- Unit: mapping function (product row → expense payload); upsert idempotency; schema validation for system vs manual.
- Unit: payroll mapping (run-level and employee-level) and upsert idempotency.
- Integration: simulate product rows → expenses created/updated; simulate payroll run → expenses created/updated; UI renders Source and category; filters work.
- Regression: manual create/edit unaffected.

## Next

- Implement schema/DB updates (source fields + unique index) if missing.
- Wire products poster and expenses UI changes.
- Implement payroll posting (choose per-run vs per-employee) using same source tagging and upsert.

## Implementation Steps: Payroll → Expenses

1. Schema/DB

- Verify expense table has `sourceType`, `sourceId`, `sourceLineKey`, `systemGenerated` and unique index `(sourceType, sourceId, sourceLineKey)`.
- If missing, add fields + index; keep `category` string values and include `Payroll`.

2. API/Service

- Add expense repository/service upsert-by-source-key helper (reuse for products and payroll).
- Add a payroll-to-expense mapper (run-level and employee-level) that outputs expense payloads with `sourceType=PAYROLL`, `sourceId=payrollRunId`, `sourceLineKey=total` or `netPay:<employeeId>`, `category=Payroll`, `systemGenerated=true`, `date=payDate`, `description` per mapping above.
- Add a batch posting method (e.g., `expenseService.upsertManyBySource`) exposed for system callers.

3. Payroll hook integration (UI side)

- In `usePayroll` (clothing), extend `handleMarkAsPaid` to:
  - Call payroll API to mark paid.
  - Invoke payroll→expense poster (client or server action) to upsert expenses for that run (and employees if per-employee option chosen).
  - Surface success/error notifications.
- Ensure idempotency so repeated mark-paid or retries do not duplicate entries.

4. UI/UX

- Expenses table: add `Source` column and `systemGenerated` indicator; allow filter by `Source` (Product/Payroll/Manual).
- Optionally lock editing of system-generated payroll rows or warn before edits.

5. Testing

- Unit: payroll mapping; upsert-by-source; parsing pay date/amounts.
- Integration: mark payroll run as paid → expenses created/updated; rerun mark-paid yields no duplicates; expenses UI shows Source=Payroll and category=Payroll.
- Regression: manual expenses and product postings unaffected.

# Trucking — Cashflow Report

> **Source files:**
>
> - `src/app/trucking/reports/cashflow/page.tsx`
> - `src/app/api/trucking/payments/route.ts`
> - `src/app/api/trucking/expenses/route.ts`

---

## A — Current Report Scope

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | The trucking cashflow view is a cash-movement report | It interprets money received and money spent rather than invoice accruals or theoretical margin. |
| 2 | Inflows are sourced from trucking payments | Payment dates and payment amounts drive the incoming side of the current report. |
| 3 | Outflows are sourced from trucking expenses | Expense dates and amounts drive the outgoing side of the current report. |
| 4 | Date-range filters constrain both inflows and outflows | The current report narrows payments and expenses by the selected time window before computing totals. |
| 5 | Net cash position is derived from inflows minus outflows | The report's balance interpretation is the difference between included payments and included expenses for the selected period. |

$$
	ext{Net Cashflow} = \sum \text{payments} - \sum \text{expenses}
$$

---

## B — Operator Interpretation Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 6 | The report answers a cash question, not a billing-completion question | A paid invoice affects cashflow through its payment receipt, while an issued invoice without payment does not create inflow here. |
| 7 | Expenses affect the report by their recorded expense date | The report is tied to the expense ledger timing, not necessarily to the trip date or payroll period alone. |
| 8 | Cashflow should be read alongside profitability rather than as a replacement for it | Profitability explains margin on trips; cashflow explains actual money movement across the selected period. |

---

## C — Current Limitations

| # | Logic | Explanation |
| --- | --- | --- |
| 9 | The cashflow surface is lighter than the invoice and payment workflows | The audited page is active, but its calculation and interaction depth are still more basic than the core finance routes. |
| 10 | Detailed bucket logic, export behavior, and richer drill-down still need a later pass if the page expands | This document captures current behavior without implying unimplemented charts, exports, or advanced grouping. |
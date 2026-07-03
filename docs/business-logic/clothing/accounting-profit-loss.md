# Clothing - Accounting: Profit & Loss Business Logic

> **Source files:**
>
> - `src/app/clothing/accounting/profit-loss/hooks/useProfitLoss.ts`
> - `src/app/clothing/accounting/profit-loss/components/ProfitLossStatsCards.tsx`
> - `src/app/clothing/accounting/profit-loss/components/ProfitLossBreakdownsPanel.tsx`
> - `src/app/clothing/accounting/profit-loss/components/ProfitLossDetailsTable.tsx`
> - `src/app/clothing/accounting/profit-loss/components/ProfitLossTable.tsx`

---

## A - Page Layout & Stat Cards

| #   | Logic                                                     | Explanation                                                                                                      |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Six stat cards at the top                                 | Revenue (blue), COGS (orange), Gross Profit (teal/red), Expenses (red), Net Profit (green/red), Period (violet). |
| 2   | Gross Profit = Revenue - COGS                             | Displayed in teal when >= 0, red when negative.                                                                  |
| 3   | Net Profit = Revenue - all Expenses (including COGS)      | Displayed in green when >= 0, red when negative.                                                                 |
| 4   | Period card: shows the currently selected period label    | e.g. `'This Month'`, `'Last Year'`, etc.                                                                         |
| 5   | Data fetched via `GET /accounting/profit-loss?period=...` | Returns `{ rows: ProfitLossRow[], stats: ProfitLossStats }`; stats are server-computed.                          |

---

## B - Period Filter

| #   | Logic                                                                                                            | Explanation                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 6   | Period options: `All Time`, `This Month`, `Last Month`, `This Year`, `Last Year`, `Last 30 Days`, `Last 90 Days` | Same period filter as Journal and Ledger.                                                           |
| 7   | Changing the period triggers a new fetch for both summary and detail rows                                        | Summary always fetched; detail rows fetched only when `activeTab` is `'details'` or `'breakdowns'`. |

---

## C - P&L Data Models

| #   | Logic                                                                                                                                       | Explanation                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 8   | Summary row: `id`, `category`, `type` (`'Revenue'` or `'Expense'`), `amount`                                                                | Aggregated by category and type.                           |
| 9   | Detail row: `id`, `date`, `category`, `type`, `sourceType`, `sourceId`, `ref`, `description`, `amount`, `customer`, `productCode`, `method` | Individual transaction-level rows.                         |
| 10  | Detail rows fetched via `GET /accounting/profit-loss/details?period=...`                                                                    | Returns `{ rows: ProfitLossDetailRow[], period: string }`. |

---

## D - Summary Table

| #   | Logic                                                                                                   | Explanation                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | Summary table groups rows by type: Revenue section first, then Expense section                          | Totals shown per section.                                                                                                                                                                   |
| 12  | Revenue rows show positive amounts; Expense rows may be displayed with sign conventions based on the UI | COGS appears as an Expense type.                                                                                                                                                            |
| 13  | Inventory COGS entries prefer explicit movement source metadata                                         | Auto-sale movement COGS links use `sourceTransactionId` when `movementSource = transaction` and `movementType = sale`; legacy `auto-sale txn {id}` notes remain fallback during transition. |

---

## E - Details Table

| #   | Logic                                                                                                                          | Explanation                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| 14  | Details tab shows transaction-level rows for the selected period                                                               | Fetched on demand when the tab becomes active. |
| 15  | Detail columns include: Date, Category, Type, Description, Amount, Customer, Product Code, Method, Ref, Source Type, Source ID | Provides full audit trail per entry.           |

---

## F - Breakdowns Panel

| #   | Logic                                                                                                                  | Explanation                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 15  | Breakdowns panel provides a visual chart of P&L over time                                                              | Fetched from detail rows when the Breakdowns tab is active.                                 |
| 16  | View granularity options: Daily, Weekly, Monthly, Quarterly, Yearly                                                    | Controls how detail rows are bucketed for the chart.                                        |
| 17  | Chart mode: Stacked or Grouped (SegmentedControl)                                                                      | Stacked bars show total height; grouped bars show each series side by side.                 |
| 18  | Date Range filter: DatePickerInput (range picker, clearable)                                                           | Overrides the period filter with a custom date range for the chart.                         |
| 19  | "Compare Previous Period" Switch                                                                                       | When enabled, overlays the previous period's Net Profit as a dashed blue line on the chart. |
| 20  | Previous period calculation: computes the duration of the current period and subtracts it from the current range start | e.g. if current period is April, previous period is March.                                  |
| 21  | Chart bars (stackable): Revenue (blue `#228be6`), COGS (red `#fa5252`), Expenses (orange `#fab005`)                    |                                                                                             |
| 22  | Chart lines (non-stacked): Net Profit (green `#40c057`), Previous Net Profit — if enabled — (dashed blue `#4dabf7`)    |                                                                                             |
| 23  | Y-axis formatter: `₱${(value / 1000).toFixed(0)}k`                                                                     | Displays values in thousands for readability.                                               |
| 24  | Clicking a bar bucket selects that bucket and shows a drill-down summary table                                         |                                                                                             |
| 25  | Drill-down summary table columns: Type, Category, Amount (right-aligned)                                               | Rows are aggregated by `Type::Category` key and sorted by amount descending.                |
| 26  | Breakdowns summary cards (totals across the filtered chart): Revenue, COGS, Expenses, Net Profit                       | Reflect the currently visible date range, not the full period.                              |

---

## G - CSV Export

| #   | Logic                                                                                                                          | Explanation                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| 27  | Summary export headers: Category, Type, Amount                                                                                 | Filename: `profit-loss.csv`.         |
| 28  | Details export headers: Date, Type, Category, Description, Amount, Customer, Product Code, Method, Ref, Source Type, Source ID | Filename: `profit-loss_details.csv`. |

---

## H - CSV Template Download

| #   | Logic                                              | Explanation                                                                               |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 29  | "Download Template" generates a blank CSV template | Filename: `profit-loss_template_${YYYY-MM-DD}.csv`. Fields: `Category`, `Type`, `Amount`. |

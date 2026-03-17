# General Merchandise — Accounting Journal Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/accounting/journal/page.tsx`
> - Shared journal route/page components under `src/app/accounting/_shared/`

---

## A — Route & API Context

| #   | Logic                                                                  | Explanation                                                                             |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | The GM journal page lives at `/general-merchandise/accounting/journal` | The route is part of the GM accounting route family.                                    |
| 2   | The page uses the shared journal route page                            | There is no GM-only journal UI implementation in this route.                            |
| 3   | The shared journal route page uses the GM API namespace                | The route passes `apiBasePath="/api/general-merchandise"` into the shared journal page. |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                      | Explanation                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 4   | The shared journal page shows summary stats cards before the working area                                                  | Operators see debit, credit, net-change, and entries-this-month cards.                                          |
| 5   | The shared controls include tab switching, search, account filtering, period filtering, and import/export/template actions | `JournalControls` drives the main filter and utility workflow.                                                  |
| 6   | Operators can open a manual journal entry modal from the controls area                                                     | The shared route wires `onAddEntry` into the controls and modal flow.                                           |
| 7   | The main table supports manual-entry edit and delete actions                                                               | `JournalListTable` exposes edit and delete handlers for manual entries.                                         |
| 8   | Add and edit journal entries use the same shared modal form                                                                | `ManualJournalEntryModal` changes title depending on whether an entry is being edited.                          |
| 9   | The GM journal workflow follows the same shared journal interaction model as the shared route page                         | Manual entry, filtering, delete flow, and journal display behavior come from the shared journal implementation. |
| 10  | GM-specific meaning comes from the GM API namespace and GM accounting data domain rather than a separate journal UI        | Workflow parity is the current baseline.                                                                        |
| 11  | Shared journal workflow changes that affect GM should also update this GM doc                                              | Shared implementation still defines GM operator behavior.                                                       |

---

## C — Documentation Notes

| #   | Logic                                                                                                             | Explanation                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 12  | The GM journal is still a distinct business workflow even though the implementation is shared                     | The route is user-visible and tied to GM accounting records. |
| 13  | If GM receives journal behavior that diverges from the shared route page, document the divergence here explicitly | This doc currently records parity as the baseline.           |

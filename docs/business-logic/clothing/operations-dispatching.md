# Clothing — Dispatching Business Logic

> **Status: Retired Clothing Alias**
>
> `/clothing/operations/dispatching` redirects to the real
> `/clothing/operations/dispatch` workflow. Module metadata points to Dispatch.
> Clothing no longer presents sample rows or simulated CRUD as operational work.

> **Source files:**
>
> - `src/modules/clothing/operations/dispatching/components/DispatchingComponent.tsx`
> - `src/app/clothing/operations/dispatching/page.tsx`
> - `src/app/api/modules/route.ts`

---

## A — Historical Scaffold

The following describes the retained shared component, not the clothing route.
General merchandise still consumes it; deleting it requires separate caller
migration. Existing clothing bookmarks use the compatibility redirect.

| #   | Logic                                                                        | Explanation                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The Dispatching page renders a placeholder UI with mock data                 | `DispatchingComponent` renders a `StandardDataTable` with five hard-coded sample rows (Test Item Alpha, Beta, Gamma, Sample Product Delta, Epsilon) whose data never changes.        |
| 2   | A search input filters the mock data client-side                             | `searchQuery` state filters `mockData` by lowercased substring match across `name`, `category`, `status`, and `quantity`. No API call is made.                                       |
| 3   | An Import CSV button triggers a simulation only                              | `handleImportCSV` sets `isImporting = true`, waits 1500 ms, then calls `showInfo('Would import file "{filename}"', 'Import Simulation')`. No data is actually imported or persisted. |
| 4   | Edit and Delete icon buttons are present in each row                         | `IconEdit` and `IconDelete` action icons are rendered per row via `ActionIcon`. Clicking them currently has no handler — the actions are not yet implemented.                        |
| 5   | The `isImporting` flag disables the import button during the simulated delay | The import button shows a loading state while `isImporting === true` to simulate an in-progress upload.                                                                              |

---

## B — Historical Plan

| #   | Logic                                                             | Explanation                                                                                                                           |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | This module is intended to manage outbound dispatching operations | When fully implemented, it will replace the simulation with real CRUD operations connected to a database-backed dispatching workflow. |
| 7   | No API routes are currently wired                                 | There are no `src/app/api/dispatching/` route handlers; the module does not yet communicate with the backend.                         |

# Clothing — Dispatching Business Logic

> **Status: Placeholder / Upcoming Module**
>
> This module exists in the sidebar navigation but is not yet fully implemented.
> The underlying `DispatchingComponent` is a scaffold with mock data and simulation-only actions.

> **Source files:**
>
> - `src/modules/clothing/operations/dispatching/components/DispatchingComponent.tsx`

---

## A — Current State

| #   | Logic                                                                        | Explanation                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The Dispatching page renders a placeholder UI with mock data                 | `DispatchingComponent` renders a `StandardDataTable` with five hard-coded sample rows (Test Item Alpha, Beta, Gamma, Sample Product Delta, Epsilon) whose data never changes.        |
| 2   | A search input filters the mock data client-side                             | `searchQuery` state filters `mockData` by lowercased substring match across `name`, `category`, `status`, and `quantity`. No API call is made.                                       |
| 3   | An Import CSV button triggers a simulation only                              | `handleImportCSV` sets `isImporting = true`, waits 1500 ms, then calls `showInfo('Would import file "{filename}"', 'Import Simulation')`. No data is actually imported or persisted. |
| 4   | Edit and Delete icon buttons are present in each row                         | `IconEdit` and `IconDelete` action icons are rendered per row via `ActionIcon`. Clicking them currently has no handler — the actions are not yet implemented.                        |
| 5   | The `isImporting` flag disables the import button during the simulated delay | The import button shows a loading state while `isImporting === true` to simulate an in-progress upload.                                                                              |

---

## B — Planned Functionality

| #   | Logic                                                             | Explanation                                                                                                                           |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | This module is intended to manage outbound dispatching operations | When fully implemented, it will replace the simulation with real CRUD operations connected to a database-backed dispatching workflow. |
| 7   | No API routes are currently wired                                 | There are no `src/app/api/dispatching/` route handlers; the module does not yet communicate with the backend.                         |

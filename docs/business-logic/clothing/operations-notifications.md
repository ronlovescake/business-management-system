# Clothing — Notifications Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/notifications/components/NotificationsClientPage.tsx`
> - `src/app/api/notifications/[entity]/route.ts`
> - `src/modules/clothing/operations/notifications/services/OperationsNotificationsService.ts`

---

## A — Tab Navigation

| #   | Logic                                                          | Explanation                                                                                 |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Four tabs are shown: Transactions, Products, Prices, Shipments | Each tab fetches its own notification feed independently from a corresponding API endpoint. |
| 2   | Each tab is a separate `NotificationsPanel` component          | Panels are isolated — switching tabs does not share or reuse state between them.            |
| 3   | Active tab defaults to "Transactions" on page load             | The `Tabs.List` has `defaultValue="transactions"`.                                          |

---

## B — Data Fetching

| #   | Logic                                                         | Explanation                                                                                   |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 4   | Each panel fetches via React Query with `staleTime: 0`        | Every mount or tab focus triggers a fresh fetch; there is no caching tolerance.               |
| 5   | `refetchOnMount: true` ensures fresh data on every tab switch | Navigating away and back always shows the latest notifications.                               |
| 6   | Data is fetched from `/api/notifications/{entity}`            | `entity` is one of: `transactions`, `products`, `prices`, `shipments`.                        |
| 7   | A Mantine `Loader` is shown while data is fetching            | Centred full-width loader replaces the table during the loading phase.                        |
| 8   | A red Mantine `Alert` is shown on fetch error                 | The alert displays the error message below the tab list.                                      |
| 9   | An empty-state message is shown when no notifications exist   | Plain text "No notifications found" is rendered if the array is empty after successful fetch. |

---

## C — Notification Grouping

| #   | Logic                                                                             | Explanation                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Notifications are grouped by: `transactionId` + `action` + `userName` + `dateKey` | `dateKey` is the ISO date string (YYYY-MM-DD) derived from the notification timestamp. All changes that share these four values are merged into a single group row. |
| 11  | Groups are sorted by most recent first                                            | The group array is sorted descending by the earliest timestamp in the group.                                                                                        |
| 12  | Each group row shows: Date, Time, User, Changes count badge                       | The Changes badge shows the action name and the number of change records in that group (e.g. "Updated · 3 changes").                                                |

---

## D — Expandable Change Detail

| #   | Logic                                                       | Explanation                                                                                                                                                  |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13  | Groups with multiple changes show an expand chevron icon    | `IconChevronRight` is shown when collapsed; `IconChevronDown` when expanded. Groups with exactly one change are not expandable (the detail is shown inline). |
| 14  | Clicking the group row toggles the Mantine `Collapse` panel | `setExpandedGroups` toggles the group key in and out of the expanded set.                                                                                    |
| 15  | The collapse sub-table shows one row per individual change  | Columns: Time, Field, Old Value, New Value.                                                                                                                  |
| 16  | Old and new values are colour-coded                         | Old value text is rendered in muted/red; new value text in green to make the diff visually apparent.                                                         |

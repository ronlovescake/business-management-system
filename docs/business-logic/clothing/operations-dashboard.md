# Clothing — Dashboard Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/dashboard/hooks/useOperationsDashboard.ts`
> - `src/modules/clothing/operations/dashboard/hooks/useDashboardData.ts`
> - `src/modules/clothing/operations/dashboard/services/DashboardService.ts`
> - `src/modules/clothing/operations/dashboard/components/DashboardPage.tsx`
> - `src/modules/clothing/operations/dashboard/components/sections/DashboardHeader.tsx`
> - `src/modules/clothing/operations/dashboard/components/sections/DashboardStatisticsGrid.tsx`
> - `src/modules/clothing/operations/dashboard/components/sections/InventoryHealthCard.tsx`
> - `src/modules/clothing/operations/dashboard/components/sections/OrderPipelineCard.tsx`
> - `src/modules/clothing/operations/dashboard/components/sections/RecentActivityCard.tsx`
> - `src/modules/clothing/operations/dashboard/components/sections/SalesPerformanceCard.tsx`
> - `src/modules/clothing/operations/dashboard/components/sections/ShipmentTimelineCard.tsx`
> - `src/modules/clothing/operations/dashboard/components/sections/SidebarHighlights.tsx`

---

## A — Page Layout

| #   | Logic                                                   | Explanation                                                                                                                                                        |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Dashboard is the landing page for Clothing > Operations | `DashboardPage` renders the full dashboard layout wrapped in a two-column structure: main content on the left and a sidebar on the right.                          |
| 2   | Main content area hosts four stacked cards              | The main column renders: Statistics Grid, Sales Performance chart, Order Pipeline funnel, and two lower cards (Inventory Health + Shipment Timeline) side by side. |
| 3   | Sidebar hosts Highlights and Recent Activity            | `SidebarHighlights` (monthly goal + today's counters) and `RecentActivityCard` are stacked in the right sidebar column.                                            |
| 4   | Loading state shows skeleton placeholders               | While `isLoading` is `true`, all cards render Mantine `Skeleton` components in place of real data.                                                                 |

---

## B — Data Loading

| #   | Logic                                                   | Explanation                                                                                                                                                                                |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 5   | Data loads once on mount via `useDashboardData`         | `useDashboardData` calls `dashboardService.aggregateDashboardData()` inside a `useEffect` with an `isMounted` guard to prevent state updates after unmount.                                |
| 6   | Loading starts as `true` and clears on completion       | `isLoading` is set to `false` in the `finally` block regardless of success or failure.                                                                                                     |
| 7   | A failed load sets `error` state                        | If the service call throws, the error is stored in `error: Error                                                                                                                           | null` state; the UI can check this to show an error zone. |
| 8   | Metrics are fed through `generateStatistics` after load | Once `dashboardData` is set, `DashboardService.generateStatistics(dashboardData.metrics)` is called synchronously to produce the statistics card array.                                    |
| 9   | Dashboard data uses mock/sample data (FUTURE: real API) | `aggregateDashboardData` currently returns hard-coded sample metrics and activity. Backend endpoints `/api/dashboard/metrics` and `/api/dashboard/activity` are planned but not yet wired. |

---

## C — Statistics Grid

| #   | Logic                                                                              | Explanation                                                                                                                            |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Four statistics cards are shown: Total Revenue, Active Orders, Customers, Products | `generateStatistics` builds exactly four cards from `DashboardMetrics`, each with a title, value, percentage change, colour, and icon. |
| 11  | Color is green/red for Revenue based on `revenueChange` sign                       | If `revenueChange >= 0` the Revenue card is green; otherwise it is red. Same pattern applies to the other three cards.                 |
| 12  | Change percentage is formatted with a leading `+` or `-`                           | `formatChange` prepends `+` to positive values and relies on the native `-` for negatives, then appends `%`.                           |
| 13  | Icons use Tabler icons                                                             | Revenue → `IconCurrencyDollar`, Orders → `IconReceipt`, Customers → `IconUsers`, Products → `IconPackage`.                             |

---

## D — Sales Performance Card

| #   | Logic                                                   | Explanation                                                                                                                                                                     |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | Chart supports three trend ranges: 7d, 30d, 90d         | `trendRange` state is initialised to `'30d'`. Three segmented-control buttons let the operator switch between Last 7 Days, Last 30 Days, and Last 90 Days.                      |
| 15  | Active range is guarded against stale dataset           | `useEffect` in `useOperationsDashboard` resets `trendRange` to the first available range whenever the `salesTrends` array changes and the current range is no longer available. |
| 16  | `trendDataset` is derived from the current `trendRange` | `useMemo` finds the matching dataset entry; if not found, it falls back to `salesTrends[0]`. Returns `null` if `salesTrends` is empty.                                          |
| 17  | Summary metrics are calculated from the active dataset  | `trendSummary` aggregates `totalRevenue`, average orders per data point (`avgOrders`), and average `fulfillmentRate` (rounded integer) from the selected dataset's points.      |
| 18  | Empty dataset produces zeroed summary                   | If `trendDataset` is null or has no points, `trendSummary` returns `{ totalRevenue: 0, avgOrders: 0, fulfillmentRate: 0 }`.                                                     |
| 19  | Chart is a Recharts `LineChart`                         | Data points are plotted as `Line` elements for Revenue and Orders; `Tooltip` and `Legend` are included.                                                                         |

---

## E — Order Pipeline Card

| #   | Logic                                                            | Explanation                                                                                                         |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 20  | Pipeline shows four stages: Prepared, Packed, Shipped, Delivered | `orderFunnelStages` is a fixed array with count, delta, and status (`positive`, `neutral`, `negative`).             |
| 21  | Clicking a stage selects it as `activeStage`                     | `setActiveStage(label)` updates the selected stage; the card highlights the active stage.                           |
| 22  | Active stage defaults to the first funnel entry                  | On mount, `activeStage` is set to `orderFunnel[0]?.label ?? ''`.                                                    |
| 23  | `selectedStage` is derived via `useMemo`                         | `orderFunnel.find(stage => stage.label === activeStage)` returns the full stage object for the active label.        |
| 24  | Delta color is positive (green), neutral (gray), negative (red)  | The `status` field on each stage drives a colour badge in `OrderPipelineCard`.                                      |
| 25  | Active stage guard resets when funnel changes                    | `useEffect` detects if `activeStage` no longer exists in the new `orderFunnel` array and resets to the first entry. |

---

## F — Inventory Health Card

| #   | Logic                                                                        | Explanation                                                                                                      |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 26  | Inventory alerts are categorised: high, medium, low                          | Each `InventoryAlert` has a `severity` field used for colour-coding — high = red, medium = orange, low = yellow. |
| 27  | Severity summary counts are computed via `useMemo`                           | `inventorySummary` iterates all alerts and counts how many are in each severity bucket.                          |
| 28  | Each alert shows: product code, description, stock level, reorder point, ETA | The `InventoryHealthCard` renders an accordion-style list where each alert row shows all five fields.            |
| 29  | ETA is optional                                                              | If `etaDays` is not set, no ETA label is shown for that alert.                                                   |
| 30  | Empty alerts list shows a placeholder                                        | When `inventoryAlerts` is empty, the card renders a "No inventory alerts" message.                               |

---

## G — Shipment Timeline Card

| #   | Logic                                                                    | Explanation                                                                                                                       |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 31  | Shipment filter controls visibility: all, In Transit, Pending, Delivered | `shipmentFilter` state supports filtering to a single status or `'all'`. The filter UI is a segmented control in the card header. |
| 32  | `filteredShipments` is derived via `useMemo`                             | When `shipmentFilter !== 'all'`, only shipments matching that status are returned; otherwise all are shown.                       |
| 33  | Each shipment shows: code, status, location, timestamp, progress bar     | `ShipmentUpdate` provides all five fields. The progress bar uses `shipment.progress` (0–100).                                     |
| 34  | Progress bar colour reflects status                                      | In Transit → blue, Delivered → green, Pending → yellow.                                                                           |
| 35  | Active filter defaults to `'all'`                                        | On mount, `setShipmentFilter('all')` ensures the full list is visible.                                                            |

---

## H — Sidebar Highlights Card

| #   | Logic                                                                                 | Explanation                                                                                             |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 36  | Monthly goal shows current vs. target with a progress bar                             | `SidebarHighlights` renders a `Progress` component using `monthlyGoal.percentage` (capped at 100%).     |
| 37  | Goal percentage is floored at 0 and capped at 100                                     | `calculateMonthlyGoal` uses `Math.min(percentage, 100)` so negative or over-100 values are never shown. |
| 38  | Today's activity shows three counters: New Orders, Pending Shipments, Low Stock Items | `todayActivity.newOrders`, `pendingShipments`, and `lowStockItems` are rendered as stat tiles.          |

---

## I — Recent Activity Card

| #   | Logic                                                           | Explanation                                                                                                                              |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 39  | Recent activities are a fixed list of timestamped events        | `recentActivities` is a plain array of `{ action, time, color }` objects with human-readable relative timestamps (e.g. "2 minutes ago"). |
| 40  | Each activity tile shows a colored dot, action text, and time   | The dot color matches the `color` field of the activity record.                                                                          |
| 41  | `formatTimeAgo` converts elapsed milliseconds to a human string | The service method converts seconds → minutes → hours → days, pluralising the unit correctly.                                            |

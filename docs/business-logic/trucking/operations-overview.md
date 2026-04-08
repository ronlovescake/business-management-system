# Trucking — Operations Overview

> **Source files:**
>
> - `src/app/trucking/operations/fleet-registry/page.tsx`
> - `src/modules/trucking/operations/fleet-registry/**`
> - `src/app/api/trucking/fleet-vehicles/route.ts`
> - `src/app/trucking/operations/vehicle-assignments/page.tsx`
> - `src/modules/trucking/operations/vehicle-assignments/**`
> - `src/app/api/trucking/vehicle-assignments/route.ts`
> - `src/app/trucking/operations/trips/page.tsx`
> - `src/app/api/trucking/trips/route.ts`
> - `src/app/trucking/operations/truck-assignments/page.tsx`

---

## A — Route Ownership And Scope

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | Trucking operations are centered on fleet vehicles, vehicle assignments, and trips | These are the main operator-managed records that describe how trucks are configured, scheduled, and used. |
| 2 | The operations landing surface is route-owned by `src/app/trucking/operations/**` | Trucking operations navigation lives under the trucking route tree rather than under shared settings or accounting. |
| 3 | Fleet registry and vehicle assignments are master-data and scheduling layers for trips | Operators maintain truck records and assignment windows before or alongside trip execution. |
| 4 | Trips are the core execution record for trucking operations | Revenue, crew, destination, and operating-cost fields are anchored to the trip record. |
| 5 | Truck assignments currently act as a legacy redirect to vehicle assignments | The route exists only to redirect operators to `/trucking/operations/vehicle-assignments`; it is not a separate workflow surface today. |

---

## B — Fleet Registry Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 6 | Fleet registry is the trucking vehicle master-data workflow | The page owns the operator workflow for maintaining vehicle identity, status, and per-unit details. |
| 7 | Fleet statistics summarize active, maintenance, newly registered, and retired units | The dashboard surface presents operational summary cards before the table and form flows. |
| 8 | Fleet list filtering is multi-dimensional | Search, status, fuel type, maker, and year filters narrow the operator table view. |
| 9 | Vehicle identity fields are normalized before persistence | Vehicle IDs, truck IDs, and plate numbers are trimmed and uppercased; textual descriptors are trimmed; empty optional strings become `null`. |
| 10 | Add and edit actions are modal-driven from the registry page | Operators create and maintain truck records without leaving the registry surface. |
| 11 | Row inspection is part of the registry workflow | The page supports a row-open or double-click review flow so operators can inspect an existing truck entry quickly. |
| 12 | Import and export are first-class registry actions | The control surface exposes bulk data actions in addition to single-record create and edit. |

---

## C — Vehicle Assignment Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 13 | Vehicle assignments link a vehicle to a crew and date window | The core assignment fields are vehicle, plate number, driver, helper, start date, end date, status, and optional route and notes. |
| 14 | Vehicle assignment statuses are `scheduled`, `active`, `completed`, and `cancelled` | These statuses drive the operator view of future work, current deployment, and closed or cancelled assignments. |
| 15 | Vehicle assignment reporting is summary-card driven at the page level | The page tracks active assignments, assignments scheduled this week, assignments ending soon, and assignments completed this month. |
| 16 | Assignment creation and update are schema-validated | The service layer and validation schema enforce the draft structure before records are accepted. |
| 17 | Vehicle assignments are the expected crew source for trips | A trip can resolve an expected driver and helper by looking up the vehicle assignment for the selected vehicle and date window. |
| 18 | Assignment persistence can degrade gracefully when the backing table is unavailable | The API is written to avoid taking down the whole UI when storage is not initialized, but persistence remains unavailable until the schema exists. |

---

## D — Trip Lifecycle Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 19 | Trips start in `draft` status | Trip creation is an operations-entry step, not automatic revenue recognition. |
| 20 | Trips become financially meaningful only when marked `completed` | The completed state is what makes a trip eligible for invoicing and analytics. |
| 21 | Completing a trip sets `completedAt` | The model records when the operations workflow moved from draft into a finished trip state. |
| 22 | Only completed trips with no existing invoice link are invoice candidates | The invoicing workflow deliberately excludes draft trips and already billed trips. |
| 23 | A trip can optionally link to a customer and later to an invoice | `customerId` and `invoiceId` are not required at creation time, but they control later billing and reporting behavior. |
| 24 | Trip revenue is operator-entered as `grossRevenue` | The trip itself is the source record for trucking revenue before billing rolls it into an invoice. |
| 25 | Trip operating-cost fields are entered directly on the trip record | Fuel liters, fuel cost, maintenance, toll fees, and misc expenses are stored as nonnegative values on the trip. |
| 26 | `totalExpenses` is a computed trip-side field | The schema treats total trip expenses as a calculated result rather than a directly keyed manual value. |
| 27 | Trip records support remarks and soft deletion | Operators can attach freeform notes, and deletion uses `deletedAt` instead of hard removal in the core trip model. |
| 28 | Crew on the trip can diverge from the expected assignment | The broader trip model supports actual crew capture and override reasoning when the assignment-derived expectation does not match the actual trip crew. |

---

## E — Current Caveats And Incomplete Areas

| # | Logic | Explanation |
| --- | --- | --- |
| 29 | `truck-assignments` should not be treated as fully equivalent to vehicle assignments yet | The route exists, but the audited implementation is not as complete or as clearly separated as the vehicle-assignment workflow. |
| 30 | Trip schema compatibility includes a customer-field fallback path | The trip API contains schema-drift handling so older databases without the `customerId` column do not break reads outright. |
| 31 | Trip cost fields and trucking expense rows are related but not identical | The trip record has embedded cost inputs, while profitability reporting separately groups rows from the trucking expense table. |
| 32 | Attendance and crew validation still need a deeper trucking-specific doc pass | The trip and assignment workflow hints at attendance linkage, but that behavior is not yet documented at the same depth as the trip status and billing rules. |
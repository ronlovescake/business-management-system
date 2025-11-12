# Change Log Feature Implementation Plan

## 1. Define Scope

- Confirm which modules/entities require logging (employees, attendance, customers, orders, products, etc.).
- Agree on captured metadata per entry: `timestamp`, `userId`, `entityType`, `entityId`, `action`, `field`, `oldValue`, `newValue`, optional `metadata/source`.

## 2. Database and Prisma Updates

- Create a migration adding a `change_log` table with indexes on `createdAt`, `entityType`, `userId`.
- Define the Prisma model (use `Json` or `String` for value fields depending on size requirements).
- Add enums/types for `ChangeLogEntityType` and `ChangeLogAction` if helpful.

## 3. Service-Layer Instrumentation

- Identify all mutation paths (create/update/delete services, bulk imports, scheduled jobs).
- Implement a reusable helper (e.g., `ChangeLogService.recordChange`) that writes entries inside existing transactions.
- Capture before/after values by loading the current row before updates.
- Ensure scripts and automated processes provide a `userId` or `source` identifier.

## 4. API Endpoints

- Expose `GET /api/change-log` with filters for date range, entity type, entity id, user id, action, and text search.
- Reuse existing validation and standard response utilities; paginate results.
- Optionally allow `POST /api/change-log` for special manual entries or system events.

## 5. Frontend UI

- Add a new page (e.g., `src/modules/admin/change-log/ChangeLogPage.tsx`) wrapped in `PageLayout`.
- Use `StandardTableControls` for filters (date range, module/entity dropdown, user).
- Display table columns: Timestamp, User, Entity, Field, Old Value, New Value, Action, Source.
- Support expanding rows or a drawer/modal to show long diffs; add CSV export and quick links from related modules.

## 6. Testing and Validation

- Write unit/integration tests for the logging helper, API filtering, and UI behavior.
- Seed representative test data to verify pagination and filter combinations.
- If large batch updates are common, run a simple load test to confirm overhead stays low.

## 7. Operations and Maintenance

- Schedule an archival job for old log entries (e.g., move records older than 12 months to cold storage).
- Ensure the new table is included in backup routines.
- Document usage and ownership in the developer docs or an ADR.

## Suggested Execution Order

1. Database migration + Prisma model.
2. Logging helper and service instrumentation.
3. API endpoints with filtering/pagination.
4. Frontend page implementation.
5. Tests, QA, and documentation updates.
6. Optional archival/monitoring tasks once the log grows.

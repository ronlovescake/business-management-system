# System-Wide Test Coverage Checklist

> Working document to track progress on comprehensive automated testing across every module. Update checkboxes as work completes.

## Foundations

- [ ] Audit current test suites and capture baseline coverage per module
- [ ] Standardize Vitest setup (custom matchers, factories, fixtures)
- [ ] Stand up Prisma test database strategy (seeding, teardown helpers)
- [ ] Extend Playwright config with shared auth/session bootstrap
- [ ] Add coverage reporting to CI (unit, integration, E2E)

## Admin

### change-log

- [ ] Unit tests for diff rendering helpers and filters
- [ ] API contract tests for audit log retrieval and write restrictions
- [ ] Component tests for pagination, search, role guards
- [ ] Playwright flow for viewing and exporting change history

## Clothing / Employees

### cash-advance

- [ ] Unit tests for request validation and amortization logic
- [ ] API contract tests (submission, approval, ledger sync)
- [ ] Component tests for forms and limit warnings
- [ ] E2E flow: request → approval → payroll export

### expenses

- [ ] Unit tests for CSV parsing and reimbursement calculations
- [ ] API contract tests (receipt upload, status transitions)
- [ ] Component tests for expense list filters and bulk actions
- [ ] E2E flow: submit expenses → manager review → payout confirmation

### leave-requests

- [ ] Unit tests for accrual and conflict detection helpers
- [ ] API contract tests (create, approve, deny, cancel)
- [ ] Component tests for calendar display and policy notices
- [ ] E2E flow: employee request → approval chain → schedule update

### thirteenth-month-pay

- [ ] Unit tests for computation formulas and pro-rating
- [ ] API contract tests for payroll snapshot endpoints
- [ ] Component tests for review tables and export dialogs
- [ ] E2E flow: generate payout → verify ledger entries → archive

## Clothing / Operations

### checkout-links

- [ ] Unit tests for link generation and expiration logic
- [ ] API contract tests for link issuance and status updates
- [ ] Component tests covering bulk link creation UI
- [ ] E2E flow: create link → customer checkout simulation → status tracking

### common utilities

- [ ] Unit tests for shared formatters, validators, hooks
- [ ] Contract tests for shared API clients and error adapters
- [ ] Component tests for reusable UI primitives
- [ ] Smoke tests for error boundary handling

### customers

- [ ] Unit tests for segmentation and tagging rules
- [ ] API contract tests for CRUD, imports, dedupe
- [ ] Component tests for list views and profile modals
- [ ] E2E flow: import customers → edit profile → sync to downstream module

### dashboard

- [ ] Unit tests for metric aggregation helpers
- [ ] API contract tests for dashboard data endpoints
- [ ] Component tests for widgets, drill-down interactions
- [ ] E2E flow: role-based dashboard load with live data refresh

### dispatch & dispatching

- [ ] Unit tests for routing algorithms and SLA calculations
- [ ] API contract tests for assignment, status updates, notifications
- [ ] Component tests for dispatch board filters and map interactions
- [ ] E2E flow: create dispatch → driver update → delivery confirmation

### due-dates

- [ ] Unit tests for due date computation and alerts
- [ ] API contract tests for scheduling endpoints
- [ ] Component tests for calendar/timeline widgets
- [ ] E2E flow: assign due date → monitor reminders → resolve

### inventory

- [ ] Unit tests for stock calculations and reconciliation logic
- [ ] API contract tests for adjustments, cycle counts, audits
- [ ] Component tests for inventory tables and barcode flows
- [ ] E2E flow: receive stock → adjust levels → verify reporting

### messaging

- [ ] Unit tests for templating, throttling, targeting
- [ ] API contract tests for outbound queue and webhook callbacks
- [ ] Component tests for composer UI and delivery history
- [ ] E2E flow: compose message → send → confirm delivery receipts

### notifications

- [ ] Unit tests for trigger rules and preference handling
- [ ] API contract tests for notification fan-out
- [ ] Component tests for inbox, banner, toast behaviors
- [ ] E2E flow: generate event → confirm multi-channel delivery

### post-template

- [ ] Unit tests for template parsing and variable substitution
- [ ] API contract tests for template CRUD and versioning
- [ ] Component tests for editor previews and diff views
- [ ] E2E flow: create template → publish → downstream consumption

### prices

- [ ] Unit tests for pricing rules and margin guards
- [ ] API contract tests for price updates and bulk uploads
- [ ] Component tests for price matrix editors
- [ ] E2E flow: adjust price → propagate to checkout and invoicing

### products

- [ ] Unit tests for SKU normalization and bundling logic
- [ ] API contract tests for product CRUD, duplication, archival
- [ ] Component tests for product forms, variant tables
- [ ] E2E flow: create product → assign pricing → push to inventory

### settings

- [ ] Unit tests for feature flag resolution and defaults
- [ ] API contract tests for org/user settings
- [ ] Component tests for settings panels and guardrails
- [ ] E2E flow: toggle setting → validate downstream behavior change

### shipments

- [ ] Unit tests for shipment status pipeline and tracking numbers
- [ ] API contract tests for shipment updates, carrier integrations
- [ ] Component tests for shipment dashboards and exception handling
- [ ] E2E flow: create shipment → scan updates → close out

### sorting-distribution

- [ ] Unit tests across services, hooks, calculations (keep current suite green)
- [ ] API contract tests for load/save/delete operations with validation
- [ ] Component tests for grids, switches, keyboard shortcuts
- [ ] E2E flow: select product → adjust distribution → persist → verify stats

### transactions

- [ ] Unit tests for reconciliation, payment allocation, ledger posting
- [ ] API contract tests for transaction imports, adjustments, exports
- [ ] Component tests for transaction lists, filters, drilldowns
- [ ] E2E flow: ingest transaction → reconcile → produce finance report

## Cross-Cutting

- [ ] Performance smoke tests for heavy grids and high-volume endpoints
- [ ] Accessibility audits (axe) for primary workflows
- [ ] Security regression tests (authz, rate limiting, input sanitization)
- [ ] Backup/restore verification for critical data sets
- [ ] Logging and monitoring validation (structured logs, alert hooks)

## Tracking

- [ ] Maintain progress dashboard (coverage %, failing suites, ownership)
- [ ] Add checklist review to weekly engineering meeting agenda
- [ ] Archive completed sections with notes on verification artifacts

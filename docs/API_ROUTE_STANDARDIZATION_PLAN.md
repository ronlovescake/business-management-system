# API Route Standardization Targets

Generated: 2025-12-02

## Primary Routes Called Out In TODO

1. `src/app/api/customers/route.ts`
2. `src/app/api/products/route.ts`
3. `src/app/api/transactions/route.ts`
4. `src/app/api/shipments/route.ts`
5. `src/app/api/prices/route.ts`

## Already Standardized

- `src/app/api/cash-advances/route.ts`
- `src/app/api/trucking/cash-advances/route.ts`
- `src/app/api/employees/[id]/salary-history/route.ts`
- `src/app/api/trucking/employees/[id]/salary-history/route.ts`
- `src/app/api/products/route.ts`
- `src/app/api/transactions/route.ts`
- `src/app/api/clothing/operations/products/shipping-fee-calculator/route.ts`
- `src/app/api/general-merchandise/operations/products/shipping-fee-calculator/route.ts`

## Additional Candidate Routes (current repo)

The command `find src/app/api -name route.ts` returned the files below. They represent the remaining ~25+ endpoints that must be aligned with the standardized factory pattern, ApiResponse envelopes, and Zod validation.

```
src/app/api/transactions/[id]/route.ts
src/app/api/backup/[timestamp]/[filename]/route.ts
src/app/api/backup/route.ts
src/app/api/generate-packing-list/route.ts
src/app/api/shipments/[id]/route.ts
src/app/api/prices/[id]/route.ts
src/app/api/thirteenth-month-pay/[recordId]/status/route.ts
src/app/api/thirteenth-month-pay/route.ts
src/app/api/sorting-distribution/route.ts
src/app/api/products/[id]/route.ts
src/app/api/trucking/thirteenth-month-pay/[recordId]/status/route.ts
src/app/api/trucking/thirteenth-month-pay/route.ts
src/app/api/trucking/schedules/route.ts
src/app/api/trucking/attendance/route.ts
src/app/api/trucking/attendance/apply-leave/route.ts
src/app/api/trucking/employee-automation-settings/route.ts
src/app/api/trucking/leave-requests/[id]/route.ts
src/app/api/trucking/leave-requests/route.ts
src/app/api/trucking/employees/[id]/route.ts
src/app/api/trucking/employees/route.ts
src/app/api/trucking/payroll/sync-lwop/route.ts
src/app/api/trucking/payroll/generate/route.ts
src/app/api/trucking/payroll/cleanup/route.ts
src/app/api/trucking/payroll/generate-payslips/route.ts
src/app/api/trucking/payroll/route.ts
src/app/api/trucking/expenses/route.ts
src/app/api/change-log/route.ts
src/app/api/auth/redirect/route.ts
src/app/api/auth/[...nextauth]/route.ts
src/app/api/auth/password/forgot/route.ts
src/app/api/auth/password/reset/route.ts
src/app/api/version-history/sync/route.ts
src/app/api/version-history/route.ts
src/app/api/schedules/route.ts
src/app/api/invoices/[id]/tickbox/route.ts
src/app/api/invoices/calculate-weights/route.ts
src/app/api/invoices/route.ts
src/app/api/permissions/check/route.ts
src/app/api/operations/notifications/route.ts
src/app/api/generate-in-transit-invoice/route.ts
src/app/api/attendance/route.ts
src/app/api/attendance/apply-leave/route.ts
src/app/api/employee-automation-settings/route.ts
src/app/api/leave-requests/[id]/route.ts
src/app/api/leave-requests/route.ts
src/app/api/inventory/check-stock/route.ts
src/app/api/message-templates/route.ts
src/app/api/users/profile/route.ts
src/app/api/users/profile/photo/route.ts
src/app/api/users/messaging/route.ts
src/app/api/users/[id]/permissions/route.ts
src/app/api/users/[id]/route.ts
src/app/api/users/route.ts
src/app/api/google-drive/sync-files/route.ts
src/app/api/employees/[id]/route.ts
src/app/api/employees/restore/route.ts
src/app/api/employees/route.ts
src/app/api/checkout-links/route.ts
src/app/api/payroll/sync-lwop/route.ts
src/app/api/payroll/generate/route.ts
src/app/api/payroll/cleanup/route.ts
src/app/api/payroll/generate-payslips/route.ts
src/app/api/payroll/route.ts
src/app/api/docs/spec/route.ts
src/app/api/generate-invoice/route.ts
src/app/api/restore/route.ts
src/app/api/customers/export/route.ts
src/app/api/customers/with-shopee/route.ts
src/app/api/customers/import/route.ts
src/app/api/customers/[id]/transactions/route.ts
src/app/api/customers/[id]/orders/route.ts
src/app/api/customers/[id]/additional-info/add/route.ts
src/app/api/customers/[id]/additional-info/route.ts
src/app/api/customers/[id]/route.ts
src/app/api/customers/with-all-addresses/route.ts
src/app/api/conversations/[id]/read/route.ts
src/app/api/conversations/[id]/messages/route.ts
src/app/api/conversations/unread-count/route.ts
src/app/api/conversations/route.ts
src/app/api/expenses/[id]/route.ts
src/app/api/expenses/route.ts
src/app/api/settings/transactions/route.ts
src/app/api/settings/invoice/route.ts
src/app/api/health/route.ts
src/app/api/clothing/operations/settings/change-log/route.ts
src/app/api/clothing/employees/dashboard/route.ts
src/app/api/clothing-attendance/route.ts
src/app/api/modules/download/route.ts
src/app/api/modules/reload/route.ts
src/app/api/modules/update/route.ts
src/app/api/modules/performance/route.ts
src/app/api/modules/config/[moduleId]/route.ts
src/app/api/modules/config/route.ts
src/app/api/modules/uninstall/route.ts
src/app/api/modules/route.ts
src/app/api/modules/install/route.ts
src/app/api/invoice-settings/reset/route.ts
src/app/api/invoice-settings/route.ts
src/app/api/generate-distribution/route.ts
src/app/api/post-template-notice/route.ts
src/app/api/marketplace/modules/route.ts
src/app/api/dispatch/orders/route.ts
src/app/api/item-weights/route.ts
```

## Next Steps

- Track progress in this file or in the main TODO as each route is standardized.
- Use the shared route factory helpers (`salary-history`, `cash-advance`) as the baseline for handler behavior and logging.

## Standardization Template

Every route refactor should follow the checklist below:

1. **Zod Schemas** – Define `query`, `create`, and `update` schemas per resource (e.g., `src/modules/<domain>/<resource>/api/schemas.ts`). Include defaults where appropriate so handlers can rely on parsed values.
2. **Sanitization Layer** – Normalize request payloads before validation. Preserve `undefined` vs `null` semantics for optional fields to match Zod expectations.
3. **Factory Invocation** – Export handlers via a factory: `const { GET, POST, PUT, DELETE } = create<Resource>Routes({ service, schemas, loggerScope })`.
4. **ApiResponse Envelopes** – All responses must flow through `ApiResponse.success`, `.badRequest`, `.notFound`, or `.error` so the UI always receives `{ success, data, error }`.
5. **withErrorHandler** – Wrap handlers to catch unexpected failures and emit structured logs.
6. **Structured Logging** – Use `logger.info` for successful operations (include identifiers/counts) and `logger.error`/`logger.warn` for validation or downstream failures.
7. **Testing** – Add Vitest coverage for each route verifying success, validation failure (400), not found (404), and unhandled error (500) responses, asserting the ApiResponse envelope fields.

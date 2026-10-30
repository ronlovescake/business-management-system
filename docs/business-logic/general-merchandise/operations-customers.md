# General Merchandise — Operations Customers Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/customers/page.tsx`
> - `src/app/general-merchandise/operations/customers/[id]/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/customers/module.config.ts`
> - `src/modules/general-merchandise/customers/api/service.ts`
> - `src/app/api/general-merchandise/customers/[id]/payments/route.ts`
> - `src/app/api/general-merchandise/transactions/payments/bulk/route.ts`
> - `src/lib/validations/transaction-payment.validation.ts`

---

## A — Routes & Shell

| #   | Logic                                                                                                                               | Explanation                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The GM customers list route lives at `/general-merchandise/operations/customers`                                                    | The route wraps the shared customers route page in the GM operations shell.                                                        |
| 2   | The GM customer detail route lives at `/general-merchandise/operations/customers/[id]`                                              | The detail route delegates to the shared customer details route page.                                                              |
| 3   | The GM customers list route explicitly uses the GM operations shell, while the detail route directly returns the shared detail page | The list route uses `renderGmOperationsPage`; the detail route is a client route that returns `CustomerDetailsRoutePage` directly. |

---

## B — Shared Workflow Baseline

| #   | Logic                                                                                             | Explanation                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4   | The GM customers workflow follows the same shared UI behavior as the shared customers route pages | Add/edit, duplicate detection, additional info handling, CSV behaviors, and detail-page interactions are shared unless GM-specific divergence is documented. |
| 5   | GM-specific customer behavior is primarily a business-data switch                                 | The route surface is shared, but the underlying records belong to the GM customer domain.                                                                    |
| 6   | GM customer workflow changes in shared customer UI should still update this GM doc                | Shared implementation does not remove the need for GM-facing documentation.                                                                                  |

---

## C — GM Customer Service Behavior

The owner-approved [shared duplicate-review rules](../clothing/operations-customers.md#d--duplicate-detection)
also apply to the shared General Merchandise Add Customer form: specific address
and exact normalized phone signals can warn independently, weak name overlap is
ignored, a fresh directory read is awaited, and the operator can Cancel or Proceed
Anyway. Evidence is advisory, not identity probability. The selected API base and
customer-domain records remain unchanged; this does not merge Clothing and GM
identities or introduce duplicate blocking in API/import/bulk paths. No cloud AI
request or automatic linking is added.

| #   | Logic                                                                                                                 | Explanation                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 7   | GM-only customer data is backed by `generalMerchandiseCustomer` extension records                                     | Each GM extension links to the canonical Clothing `Customer` by `clothingCustomerId`.                |
| 8   | The GM customer service exposes active-customer lookup, bulk sync, create, and soft-delete-all behavior               | These service methods define the customer data-management surface under GM APIs.                     |
| 9   | GM customer DTO mapping reuses the shared customer DTO conversion helpers                                             | The service maps to and from shared customer DTO shapes while storing records in GM-specific tables. |
| 10  | Bulk synchronization and create flows should be treated as GM customer workflow even though the DTO mapping is shared | GM data ownership stays separate from other businesses.                                              |

## Payment Amount Validation

| #   | Logic                                                           | Explanation                                                                                                                                                                                              |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | GM direct and bulk collections require finite positive amounts  | Both consume the shared payment-create schema, which rejects zero, negative and non-finite input.                                                                                                        |
| 12  | GM normalized payments must remain positive                     | Both routes use the existing two-decimal sanitizer and reject amounts that round to zero before inserting payments or updating balances. One-cent payments and existing rounding behavior are preserved. |
| 13  | Invalid amounts reject the complete bulk request before writing | A batch containing both valid and invalid amounts writes neither payment. This input guarantee does not claim concurrency/idempotency protection for valid requests.                                     |

Amount validity matches the
[Clothing customer collection safeguard](../clothing/operations-customers.md#payment-amount-validation).
GM records and its existing direct/bulk status, balance and transaction behavior
remain separate. No historical payment, refund accounting or overpayment policy
is changed by this safeguard.

## Permanent Order Customer Identity

Clothing `Customer` is the canonical customer identity and name. A GM customer
extension is linked explicitly through `GeneralMerchandiseCustomer.clothingCustomerId`;
`GeneralMerchandiseTransaction.customerId` references the GM extension, preserving
GM-specific history and payment/refund ownership. GM customer detail pages use
the canonical profile but query orders, transactions, refunds, and additional
information through GM endpoints only.

When the canonical customer is renamed, its linked GM extension is updated and
the database triggers synchronize transaction display names in both domains.
This covers all statuses and soft-deleted orders without changing financial
fields or inventory. Exact unique existing names are backfilled; unknown or
duplicate names remain unlinked for explicit review. Do not assume numeric IDs
are equal across the Clothing and GM tables.

The [shared identity and rollout rules](../clothing/operations-customers.md#permanent-order-customer-identity)
also apply to GM. For historical-name reports or confirmed mappings, use
`npx tsx scripts/reconcile-order-customers.ts --env .env.test --domain general-merchandise`.
Add `--from "Old Name" --customer-id 123` to preview a verified mapping and
`--apply` only after review. For General Merchandise, `--customer-id` is the GM
extension ID, not the canonical Clothing customer ID.

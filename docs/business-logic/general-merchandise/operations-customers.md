# General Merchandise — Operations Customers Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/customers/page.tsx`
> - `src/app/general-merchandise/operations/customers/[id]/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/customers/module.config.ts`
> - `src/modules/general-merchandise/customers/api/service.ts`

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

| #   | Logic                                                                                                                 | Explanation                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 7   | GM customer persistence is backed by `generalMerchandiseCustomer` records                                             | The GM customer service uses GM Prisma bindings instead of Clothing customer models.                 |
| 8   | The GM customer service exposes active-customer lookup, bulk sync, create, and soft-delete-all behavior               | These service methods define the customer data-management surface under GM APIs.                     |
| 9   | GM customer DTO mapping reuses the shared customer DTO conversion helpers                                             | The service maps to and from shared customer DTO shapes while storing records in GM-specific tables. |
| 10  | Bulk synchronization and create flows should be treated as GM customer workflow even though the DTO mapping is shared | GM data ownership stays separate from other businesses.                                              |

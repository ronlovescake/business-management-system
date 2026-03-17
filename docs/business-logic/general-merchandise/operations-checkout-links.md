# General Merchandise — Operations Checkout Links Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/checkout-links/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/checkout-links/module.config.ts`

---

## A — Route & API Context

| #   | Logic                                                                                | Explanation                                                                                                          |
| --- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | The GM checkout-links page lives at `/general-merchandise/operations/checkout-links` | The module is labeled `Invoicing` in the GM operations navigation.                                                   |
| 2   | The route renders through the shared GM operations shell                             | The route uses `renderGmOperationsPage`.                                                                             |
| 3   | The shared checkout-links route page uses the GM API namespace                       | The route passes `apiBasePath="/api/general-merchandise"` into the shared checkout-links page.                       |
| 4   | Checkout-link creation still uses the shared checkout-links API base path            | The route also passes `checkoutLinksApiBasePath="/api"`, so link-generation endpoints remain on the shared API root. |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                                              | Explanation                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | The GM checkout-links workflow follows the same shared invoicing, checkout-link generation, and related operator behavior as the shared route page | There is no GM-only checkout-links UI implementation in this route.                                                                          |
| 6   | The shared workflow is split across five tabs                                                                                                      | The route exposes `Invoicing`, `Local Invoicing`, `Customer Orders`, `Item Weight`, and `Checkout Link` tabs.                                |
| 7   | Invoicing and local invoicing both include search-driven invoice workflows tied to checkout-link lookup utilities                                  | The shared component wires search, customer-name actions, tickbox changes, and weight-based checkout-link resolution into both invoice tabs. |
| 8   | The invoicing tab includes a Google Drive sync action                                                                                              | The shared component exposes `onSyncGoogleDrive` and `isSyncing` for the invoicing tab workflow.                                             |
| 9   | Customer Orders and Item Weight are read/search-focused tabs inside the same workflow surface                                                      | Customer Orders is filtered via search, while Item Weight supports search plus an `Open Products` handoff.                                   |
| 10  | The Checkout Link tab includes import, export, edit, delete, and modal-based update behavior                                                       | The shared tab wires CSV import/export, edit/delete actions, and a `CheckoutLinkEditorModal`.                                                |
| 11  | GM-specific meaning comes from the GM path and mixed API bindings rather than a different invoicing interaction model                              | The page uses the GM business API namespace together with the shared checkout-links API root.                                                |
| 12  | Shared checkout-links workflow changes that affect GM should also update this GM doc                                                               | Shared implementation still defines GM operator behavior.                                                                                    |

---

## C — Documentation Notes

| #   | Logic                                                                                                                  | Explanation                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 13  | The GM module is part of the operations navigation under the label `Invoicing`                                         | The module config names the route as an invoicing-focused operations surface. |
| 14  | If GM receives checkout-link behavior that differs from the shared route page, document the divergence here explicitly | This doc currently records parity as the baseline.                            |

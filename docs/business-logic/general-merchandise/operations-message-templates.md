# General Merchandise — Operations Message Templates Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/message-templates/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/message-templates/module.config.ts`
> - Shared message-template route/page components under `src/app/operations/message-templates/_shared/`

---

## A — Route & Shell

| #   | Logic                                                                                      | Explanation                                                                                                            |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | The GM message-templates page lives at `/general-merchandise/operations/message-templates` | The route path is GM-specific and registered in the GM module config.                                                  |
| 2   | The route renders through the shared GM operations shell                                   | The route uses `renderGmOperationsPage`.                                                                               |
| 3   | The route uses the shared message-template UI workflow                                     | There is no GM-only message-template UI implementation; the route feeds GM data into the shared message-template page. |

---

## B — GM-Specific Data Seeding & Persistence

| #   | Logic                                                                                           | Explanation                                                                                                |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 4   | The route loads GM message templates from `generalMerchandiseMessageTemplate` records           | The page queries GM-specific template records before rendering.                                            |
| 5   | Missing default templates are seeded automatically into the GM table                            | The route compares stored template slugs against `DEFAULT_MESSAGE_TEMPLATES` and inserts missing defaults. |
| 6   | If the GM table is empty, the page falls back to the default template set                       | An empty table returns the default in-memory template list.                                                |
| 7   | If template loading fails, the route logs the failure and still falls back to default templates | The page avoids hard failure on template-load errors.                                                      |

---

## C — Workflow Baseline

| #   | Logic                                                                                                                         | Explanation                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 8   | Once the template data is loaded, the GM route shows the shared template board without the default header or usage hint       | The route passes `showHeader={false}` and `showUsageHint={false}` into `MessageTemplatesBoard`.           |
| 9   | Template copy actions remain enabled in the GM route                                                                          | The board defaults `showCopy` to enabled, so operators can copy template content directly from the board. |
| 10  | Inline editing is not enabled by the current GM route props                                                                   | The board defaults `allowEditing` to `false`, and the route does not supply save/create handlers.         |
| 11  | The board can still expose an Add New Template CTA through navigation instead of inline creation                              | The route passes an `addTemplateCtaHref`, so the add action is currently link-driven.                     |
| 12  | Shared message-template UI changes that affect GM should also update this GM doc                                              | Shared implementation still defines GM operator behavior.                                                 |
| 13  | Changes to default-template seeding or GM persistence are GM-specific workflow changes and must be documented here explicitly | The seeding/persistence behavior is the clearest current GM-specific difference.                          |

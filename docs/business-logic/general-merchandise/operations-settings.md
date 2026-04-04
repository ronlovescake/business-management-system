# General Merchandise — Operations Settings Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/settings/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/settings/module.config.ts`
> - Shared settings route/page components under `src/app/operations/settings/_shared/` and `src/modules/clothing/operations/settings/`

---

## A — Route Entry & Redirects

| #   | Logic                                                                        | Explanation                                                                                                           |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | The GM settings page lives at `/general-merchandise/operations/settings`     | The route path is registered as a GM operations module.                                                               |
| 2   | `?tab=backup` redirects to `/admin/backup-restore`                           | Backup & Restore has been centralized under `/admin`, so the GM settings route redirects old backup-tab entry points. |
| 3   | The centralized admin backup page now includes scheduled-backup and PITR visibility | The redirected admin page now shows scheduled logical backup behavior plus PostgreSQL PITR / WAL status and base-backup controls instead of an embedded GM-only backup tab. |
| 4   | Detailed backup cadence and recovery procedures stay in the operational docs | This GM business-logic doc records the redirect surface only; exact scheduler cadence, WAL archiving, PITR restore steps, and container requirements are documented in `docs/DEPLOYMENT.md`. |
| 5   | The route renders through the shared GM operations shell for non-backup tabs | The route uses `renderGmOperationsPage` after redirect handling.                                                      |

---

## B — Shared Workflow Baseline

| #   | Logic                                                                                                                           | Explanation                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 6   | The GM settings route follows the same shared settings workflow surface as the shared settings route page                       | The route delegates to `SettingsRoutePage` rather than a GM-only settings UI. |
| 7   | GM-specific meaning comes primarily from the route path and business context rather than a different settings interaction model | Workflow parity is the current baseline.                                      |
| 8   | Shared settings workflow changes that affect GM should also update this GM doc                                                  | Shared implementation still defines GM operator behavior.                     |

---

## C — Metadata & Documentation Notes

| #   | Logic                                                                                                                                            | Explanation                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | The GM settings module metadata still describes marketplace/plugins behavior                                                                     | The module config description and tags mention marketplace/modules/plugins even though the route currently behaves as the shared configuration page plus backup redirect. |
| 10  | The metadata description should not be treated as a full workflow source of truth on its own                                                    | Route behavior and shared page behavior are the authoritative workflow surfaces.                                                                                          |
| 11  | Any future GM-only settings divergence must be documented here explicitly                                                                        | This doc currently records shared-workflow parity plus the backup redirect.                                                                                               |
| 12  | If marketplace-specific behavior returns to the live GM settings route, this doc must be expanded to cover it explicitly                        | The current route no longer uses the old embedded backup tab flow.                                                                                                        |
| 13  | Settings changes that affect Accounting, Transactions, invoice templates, or backup entry points should be cross-checked against related GM docs | Settings workflow can affect multiple GM business areas.                                                                                                                  |

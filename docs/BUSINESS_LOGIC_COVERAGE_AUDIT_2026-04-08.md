# Business Logic Coverage Audit (2026-04-08)

This file records the current documentation coverage of the application's business logic.

Status meanings:

- `Detailed` — detailed numbered-rule docs exist
- `Overview` — a route / module map exists, but not the full extracted rule set
- `Placeholder` — the surface exists but the documentation is intentionally scaffold-level
- `Gap` — the surface exists in code, but the business-logic documentation still needs a dedicated doc

---

## Domain Coverage

| Area | Surface | Status | Notes |
| --- | --- | --- | --- |
| Clothing | Operations | Detailed | Mature doc set already exists. |
| Clothing | Accounting | Detailed | Mature doc set already exists. |
| Clothing | Employees | Detailed | Mature doc set exists, including placeholders and redirects where applicable. |
| General Merchandise | Operations | Detailed | Parallel doc set exists. |
| General Merchandise | Accounting | Detailed | Parallel doc set exists. |
| General Merchandise | Employees | Detailed | Parallel doc set exists; redirect-only and shared-workflow surfaces are documented, with only a small number of backend-only parity notes still worth extracting later. |
| Household Finance | Overview and module docs | Detailed to Overview | Household has a strong overview set plus module docs; no active accuracy defects remain from the April 8 verification passes. |
| Trucking | Domain overview | Detailed | Trucking now has domain-level docs plus detailed operations, finance, profitability, and cashflow rules. |
| Trucking | Operations | Detailed | Fleet, vehicle assignments, trip lifecycle, and current caveats are documented rule by rule. |
| Trucking | Finance | Detailed | Invoices, payments, expenses, profitability linkage, trip-finalization expense creation, and cashflow interpretation are documented. |
| Trucking | Employees | Overview | Surface is mapped, but detailed rule docs still need extraction. |

---

## Platform / Shared Coverage

| Area | Surface | Status | Notes |
| --- | --- | --- | --- |
| Platform | Auth and access | Detailed | Login, session, password reset, profile, and permission rules are documented. |
| Platform | Admin backup and restore | Detailed | Backup/restore workflow, runner state, artifact contract, and destructive restore rules are documented. |
| Platform | Settings and configuration | Detailed | Global settings, payment cards, invoice settings, accounting settings, and transactions settings are documented. |
| Platform | Change log and version history | Detailed | Redirect ownership, audit filters, UI behavior, and current version-history limits are documented. |
| Platform | User management and permissions | Overview | Shared user-management doc exists; rule-level extraction still needed. |
| Platform | Module marketplace and module operations | Detailed | Module registry, install/update/reload/config, download, and performance routes are documented. |
| Platform | Shared employee automation | Overview | Shared automation doc exists; detailed operational rules still need extraction. |
| Platform | Internal messaging and conversations | Detailed | Conversation creation, unread state, visibility, and participant rules are documented. |

---

## Route-Surface Notes

The following route families are especially important because they represent cross-domain or platform behavior and should continue to have dedicated docs or explicit rule references:

- `src/app/settings/**`
- `src/app/admin/**`
- `src/app/login/**`, `src/app/forgot-password/**`, `src/app/reset-password/**`, `src/app/profile/**`
- `src/app/api/backup/**`, `src/app/api/restore/**`
- `src/app/api/modules/**`, `src/app/api/marketplace/**`, `src/app/api/version-history/**`, `src/app/api/change-log/**`
- `src/app/api/conversations/**`, `src/app/api/users/messaging/**`

---

## Accuracy Reconciliation

The April 8 third-pass and fourth-pass reviews changed the earlier coverage interpretation in three important ways:

- Raw route-count coverage materially overstated the documentation gap. Many route families are already documented through workflow-level docs rather than route-by-route API catalogs.
- Several previously reported gaps were reclassified as already covered: recurring payments, checkout-links / invoicing subflows, Google Drive sync, profile management, and substantial parts of trucking and general-merchandise shared-workflow coverage.
- The remaining work is now primarily precision work: correcting wording, documenting a small number of backend-only behaviors, and extracting detailed rules for a few overview-only areas.

Confirmed documentation defects identified during the verification passes have now been corrected in the source docs, including:

- general-merchandise redirect destinations
- trucking profitability and trip-finalization finance caveats
- trucking truck-assignments redirect behavior
- platform auth landing-path wording
- profile photo workflow coverage
- clothing stock-alert copy alignment
- backup/restore checksum enforcement wording
- clothing transaction soft-delete wording

---

## Residual Gaps After Reconciliation

The following items remain the real documentation follow-up set after removing overstated route-count gaps:

1. Trucking employees still need full rule extraction rather than overview-only mapping.
2. Platform user management and permissions still need detailed numbered-rule extraction beyond the current overview notes.
3. Platform shared employee automation still needs rule-level documentation of scheduler, settings, and internal-run behavior.
4. A small number of backend-only invoice-generation utilities, especially standalone `generate-invoice` / `generate-in-transit-invoice` surfaces, still warrant explicit business-logic documentation if endpoint-level completeness is required.
5. Some low-priority maintenance and cleanup routes remain intentionally under-documented because they are operational utilities rather than primary operator workflows.

---

## Priority Order For The Next Detailed Pass

1. Trucking employees
2. Platform user management and permissions
3. Platform shared employee automation
4. Standalone invoice-generation utility surfaces
5. Low-priority maintenance / cleanup route families if operational documentation depth is desired

---

## Current Working Conclusion

The repository has a documentation home for every major domain and cross-domain area, and the business-critical workflow coverage is substantially stronger than the earlier raw route-count estimate implied.

What is still incomplete is no longer the existence of documentation homes for trucking and platform logic.

The remaining work is concentrated in a short list of deeper rule-extraction and backend-utility follow-ups:

- trucking employees
- user management and permissions
- shared employee automation
- standalone invoice-generation utility surfaces
- optional low-priority maintenance / cleanup documentation

Those are now explicit follow-up tasks instead of undocumented gaps.
# Developer Onboarding Guide

This guide is the human-facing version of the repository developer instructions. Use it when you are new to the codebase, coming back after time away, or handing the repo to another engineer.

Start with this guide, then use `README.md` for commands and `docs/README.md` for the rest of the documentation map.

## 1. What This Repository Is

This is one application that serves several business areas:

- Clothing
- General merchandise
- Trucking
- Household finance
- Platform and admin

That matters because many changes are not isolated. A route, report, or workflow can have accounting, inventory, payroll, or permission side effects.

## 2. How The Repo Is Organized

- `src/app/**`: Next.js App Router UI routes and API route handlers
- `src/app/api/**`: API endpoints
- `src/modules/**`: business-domain modules
- `src/core/**`: module system and shared core infrastructure
- `src/lib/**`: auth, database, shared server/client utilities
- `src/components/**`: reusable UI
- `src/services/**`, `src/utils/**`, `src/shared/**`: shared logic and helpers
- `prisma/schema.prisma`: database schema

If you are trying to understand behavior, follow the path in this order:

1. Route or page entry point
2. Module or service handling the logic
3. Prisma model or persistence layer
4. Permission checks
5. Related docs and tests

## 3. First-Day Setup

Minimum local setup:

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Useful follow-up checks:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Default local dev server:

- `http://0.0.0.0:5001`

Use `README.md` for the current command list and `docs/DEBUGGING.md` for VS Code setup.

## 4. Rules That Matter Most

### Keep Scope Tight

- Make the requested change and avoid unrelated cleanup.
- Prefer fixing the root cause instead of layering in another workaround.
- Do not weaken validations, tests, permissions, or safety checks to get a change through.

### Treat These Areas As High Risk

- Authentication and permissions
- Prisma schema and data migrations
- Backup and restore flows
- Inventory and ledger movement logic
- Payroll, trucking invoices, and payment flows

If you change one of those areas, assume there may be downstream effects and validate more than usual.

## 5. Domain Expectations

Clothing and general merchandise often mirror each other, but they are not always identical.

When you change one side, always ask:

1. Does the parallel business area need the same change?
2. If not, is the difference intentional and documented?
3. Does the change affect shared accounting, inventory, or employee assumptions?

Do not assume every business area shares the same tables or workflows. The repository uses multiple schemas, and some domains intentionally diverge.

## 6. Auth And Permissions

Authentication uses NextAuth credentials.

- Auth configuration lives in `src/lib/auth/auth.ts`
- Route protection lives in `src/middleware.ts`
- The route → allowed-roles map lives in `src/core/routePermissions.ts`
  (single source of truth, longest-prefix matching, edge-runtime safe).
  Edit access control there.

When you add or change protected behavior, review all three layers together:

1. Middleware access rules (the prefix entry in `src/core/routePermissions.ts`)
2. Server-side permission checks
3. Permission-driven UI behavior

`BYPASS_AUTH_FOR_TESTS=true` is only for test scenarios — read it via
`isAuthBypassed()` from `src/lib/auth/bypass.ts`. Do not rely on it for
normal development or design decisions; it is guarded against running
in production.

## 7. Database Safety

The Prisma datasource uses PostgreSQL with at least these schemas:

- `public`
- `general_merchandise`

Safe working rules:

- Keep schema changes non-destructive.
- Do not drop tables or columns casually.
- Respect soft-delete patterns such as `deletedAt`.
- Use `prisma db push` and `prisma migrate dev` only in safe local or test environments.
- If you touch backup, restore, or repair utilities, document risk and test carefully.

## 8. Modules And Navigation

This repo has a module/plugin pattern. Before creating new domain features, inspect the existing module registry and nearby module implementations.

- `src/core/ModuleRegistry.ts` is the main reference point.
- Prefer the module scaffold script instead of inventing a one-off layout.

```bash
npm run generate:module -- --name=<module-name> --domain=<clothing|general-merchandise|trucking|household|shared>
```

New modules should line up with:

- route registration
- navigation metadata
- business and workspace context
- permissions (add the prefix entry in `src/core/routePermissions.ts`)

### Shared route factories

Before writing a route by hand, check whether one of the shared
factories already covers your case:

- `createCrudRoutes` in `src/core/api/factory.ts` — generic CRUD,
  Zod-validated, paginated, standard envelope.
- `createInvoiceRoutes<T>` in `src/modules/invoices/api/invoiceRouteFactory.ts`
  and `createTransitBuildRoutes<T>` in
  `src/modules/shipments/api/transitBuildRouteFactory.ts` — both are
  generic over the concrete Prisma delegate.
- `createManualJournalRouteHandlers` and the `OpeningBalanceModel`
  adapter in `src/modules/shared/ledger/**` for ledger flows.

For pagination and the standard response envelope, use
`parsePaginationParams` + `paginatedResponse` from
`src/lib/api/pagination.ts` and wrap handlers with `withApiLogging`
from `src/lib/api/withApiLogging.ts`. The module generator scaffolds
this for you.

## 9. Validation Workflow

Run the smallest useful validation while you are iterating. Before handoff, use the change type to decide what to run.

Default baseline:

```bash
npm run guardrails:check
npm run lint
npm run typecheck
```

Also run these when relevant:

- Shared logic, auth, APIs, Prisma, accounting, inventory, or cross-domain changes: `npm run test:unit` and `npm run test:integration`
- Security-sensitive or browser/runtime-sensitive changes: `npm run test:hardening`
- Critical business logic regressions or confidence-building passes: `npm run test:coverage`
- Inventory or ledger changes: `npm run inventory:ledger:controls`
- Accounting transaction changes: `npm run accounting:transactions:sanitycheck`
- End-to-end browser flow changes: Playwright only when explicitly needed

Do not skip checks by disabling tests or reducing safety rules.

## 10. Documentation Expectations

The main navigation entry points are:

- `README.md`
- `docs/README.md`
- `docs/BUSINESS_LOGIC_INDEX.md`

Documentation rules:

- Update docs when behavior, routes, policies, or commands change.
- Keep new navigation docs at the top level of `docs/`.
- Keep historical material under the historical and reports structure, not mixed into active operational docs.
- Prefer direct filenames and plain English.

## 11. Practical Working Style

Before coding:

1. Find the real entry point for the behavior.
2. Check whether there is a parallel implementation in another business area.
3. Read the relevant Prisma models and permission logic.
4. Decide what validation is required before you touch the code.

Before handoff:

1. Summarize what changed.
2. Explain why it changed.
3. State what validation you ran.
4. Call out residual risk if any exists.

## 12. Git Confirmation Hooks

This repository uses interactive Husky hooks for `git commit` and `git push`.

- Every commit asks for confirmation before the existing pre-commit checks run.
- Every push asks for confirmation before Git sends anything to the remote.
- If you answer no, the action stops.
- This is intended to prevent accidental commits or pushes by both humans and AI tools.

These hooks are a local safety layer, not an absolute security boundary. They can still be bypassed with Git options such as `--no-verify`, so use remote branch protection as an additional safeguard when needed.

If you are authorized to commit, write commit messages that explain what changed, why, affected areas, and follow-up risk. Avoid vague commit messages.

## 13. Where To Look Next

- `README.md`: commands, scripts, environment, deployment basics
- `CONTRIBUTING.md`: contributor workflow and coding standards
- `docs/README.md`: documentation hub
- `docs/BUSINESS_LOGIC_INDEX.md`: business-domain shortcuts
- `docs/reports/archive/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md`: concise architecture summary (archived 2026-04-19)
- `IMPROVEMENTS_CHECKLIST.md`: tracked repo-wide improvements

# Repo-Verified Executive Summary — 2026-03-29

## Purpose

This document is the short, reusable version of the repo-wide analysis. It reflects a validation pass against the live repository as of 2026-03-29 and is intended for quick orientation, planning, and audit handoff.

## What This Repository Is

This is a multi-business operations and accounting platform for four business areas:

- Clothing
- General merchandise
- Trucking
- Household / personal finance

Each business area combines operations workflows, accounting, and employee management on a shared platform.

## Verified Stack

- Next.js 14 App Router
- TypeScript with strict typing
- Prisma 5 with PostgreSQL multi-schema support
- React Query v5
- Mantine 7
- Zustand
- Zod
- NextAuth v4 with credentials auth
- Vitest for unit, integration, and hardening tests
- Playwright for browser E2E testing
- Sentry integration
- Docker / docker compose deployment support

## Verified Architecture

- The database uses two PostgreSQL schemas: `public` and `general_merchandise`.
- Auth is role-based with `USER`, `ADMIN`, and `SUPER_ADMIN`.
- Front-end route access is enforced in middleware.
- Fine-grained module access is implemented through `Module` and `UserPermission` records.
- The platform includes a dynamic module/plugin system with registry, loader, plugin manager, and module API routes.
- Backup and restore are first-class features with manifest/checksum handling and ordered restore support.
- OpenAPI docs are exposed through the app’s docs UI and `/api/docs/spec` endpoint.

## Domain Overview

### Clothing

- Broadest operational surface.
- Covers transactions, products, prices, shipments, customers, inventory, dispatch, bundles, messaging, invoicing, accounting, and payroll.

### General Merchandise

- Mirrors the clothing domain closely.
- Uses the `general_merchandise` schema for GM-specific operational, employee, payroll, and accounting models.

### Trucking

- Covers fleet registry, vehicle assignments, trips, invoices, payments, analytics, and trucking-specific employees/payroll.

### Household / Personal

- Covers accounts, expenses, income, budgets, and recurring payments.

## Testing Snapshot

- 120 current unit test files.
- 3 integration test files.
- 4 hardening test files focused on backup/restore.
- Playwright runs on port 3100 and defines Chromium, Firefox, and WebKit projects.
- Trucking still appears thinner in test depth than clothing and GM, especially outside the trip flow.

## Important Corrections From Prior Drafts

- General merchandise employees are not shared with `public.employees`; GM employee and payroll models exist in the `general_merchandise` schema.
- `env.ts` does not centrally validate every environment variable used in the repo. Google Drive settings, `BACKUP_DIR`, and `BYPASS_AUTH_FOR_TESTS` are used outside that schema.
- `BYPASS_AUTH_FOR_TESTS` is not a universal bypass across every auth helper; it is honored in middleware and module-permission flows.
- Playwright is not Chromium-only in config; the suite defines Chromium, Firefox, and WebKit projects.

## Main Risks / Gaps

- Trucking still looks under-tested relative to other domains.
- Clothing and GM accounting still carry meaningful duplication, especially around balance-sheet routes and COGS logic.
- The payroll deductions engines remain highly similar across business copies according to `CHECKLIST.md`, but are not fully consolidated.
- Integration coverage is shallow for the size of the codebase.

## Practical Reading Order

1. Read the full repo analysis in the repository root for detail.
2. Use `CHECKLIST.md` for current duplication and consolidation work.
3. Use `docs/HISTORICAL_INDEX.md` for retained refactor-history context.
4. Use the source code and tests as final authority when a document and implementation diverge.
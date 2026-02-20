# Business Management System

Production business platform built with Next.js + TypeScript + Prisma.

This repository serves multiple business domains in one app, with domain-parity patterns across clothing, general merchandise, trucking, and household finance.

## Current Scope (Active Domains)

- Clothing: operations, ledger/accounting, employees.
- General merchandise: operations, ledger/accounting, employees.
- Trucking: fleet/vehicle assignments, trips, payroll, expenses, invoices, payments.
- Personal/household: accounts, budgets, expenses, income, recurring payments.
- Platform/admin: auth, permissions, users, backup/restore, module marketplace, change/version history.

## Architecture at a Glance

- App routes/UI: `src/app/**`
- API routes: `src/app/api/**`
- Domain logic: `src/modules/**`
- Shared/core libraries: `src/lib/**`, `src/core/**`, `src/components/**`, `src/services/**`, `src/utils/**`
- Data model: `prisma/schema.prisma`

## Route Topology Snapshot (2026-02-20)

- App-router artifacts (`page.tsx`, `layout.tsx`, `route.ts`): **367**
- Pages: **127**
- API routes: **235**
- Dynamic routes (`[...]`): **60**

Detailed side-map and hotspot scan:

- `docs/REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md`

## Local Development

### Start app

```bash
npm install
npm run dev
```

Default dev host/port:

- `http://0.0.0.0:5001`

Playwright-focused dev server:

```bash
npm run dev:playwright
```

### Typecheck and lint

```bash
npm run lint
npm run typecheck
```

### Test suites

```bash
npm run test:unit
npm run test:integration
npm run test:hardening
npm run test:coverage
```

Full quality chain:

```bash
npm run test:full
```

## Guardrails and CI

Run before PR:

```bash
npm run guardrails:check
npm run ci:quality
```

CI workflow:

- `.github/workflows/quality-gates.yml`

Engineering policy and anti-entropy standards:

- `.github/instructions/development.instructions.md`

## Database and Prisma

Generate Prisma client:

```bash
npm run db:generate
```

Push schema (non-destructive environments only):

```bash
npm run db:push
```

Open Prisma Studio:

```bash
npm run db:studio
```

## New Module Scaffolding Standard

Create new modules with the repository scaffold:

```bash
npm run generate:module -- --name=<module-name> --domain=<clothing|general-merchandise|trucking|household|shared> [--section=<section>] [--table=<handsontable|mantine|custom>] [--withPage=true]
```

Example:

```bash
npm run generate:module -- --name=inventory-aging --domain=clothing --section=operations --table=handsontable --withPage=true
```

## Operational Scripts (Selected)

Inventory/ledger controls:

```bash
npm run inventory:ledger:controls
```

Accounting transaction sanity check:

```bash
npm run accounting:transactions:sanitycheck
```

## Documentation Index

- Contributor process: `CONTRIBUTING.md`
- Refactor execution summary: `docs/REFACTOR_EXEC_SUMMARY_2026-02-14.md`
- Repo side-map deep scan: `docs/REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md`
- Repository logic + computation map: `docs/REPOSITORY_LOGIC_AND_COMPUTATION_MAP_2026-02-20.md`
- Repository sitemap tree + diagram: `docs/REPOSITORY_SITEMAP_TREE_DIAGRAM_2026-02-20.md`
- Engineering policy: `.github/instructions/development.instructions.md`

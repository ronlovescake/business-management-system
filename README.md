# Business Management Development

This repository contains the business management platform codebase (Next.js + TypeScript), including domain modules for clothing, general-merchandise, trucking, household, accounting/ledger, and shared services.

## Contributor Quick Start

Before opening a PR, run:

- `npm run guardrails:check`
- `npm run ci:quality`
- `npm run test:coverage` (when coverage evidence is required)

## Quality and Guardrails

- Local enforcement commands are defined in `package.json`.
- CI enforcement workflow: `.github/workflows/quality-gates.yml`.
- Repo-wide development policy and anti-entropy rules: `.github/instructions/development.instructions.md`.

## Module Scaffolding Standard

Create all new modules with the repo-wide scaffold:

```bash
npm run generate:module -- --name=<module-name> --domain=<clothing|general-merchandise|trucking|household|shared> [--section=<section>] [--table=<handsontable|mantine|custom>] [--withPage=true]
```

Example:

```bash
npm run generate:module -- --name=inventory-aging --domain=clothing --section=operations --table=handsontable --withPage=true
```

## Additional References

- Contribution process: `CONTRIBUTING.md`
- Engineering policy: `.github/instructions/development.instructions.md`

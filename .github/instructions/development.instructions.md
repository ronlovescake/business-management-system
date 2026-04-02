---
applyTo: "**"
description: "Repository-wide developer instructions for the Business Management System. Use for architecture, workflow, safety, testing, schema, and documentation decisions anywhere in this repo."
---

# Business Management System Developer Instructions

## 1. Scope And Change Discipline

- Make only the requested change. Keep diffs tight and avoid unrelated cleanup.
- Prefer root-cause fixes over surface patches.
- Do not commit, push, deploy, or run production builds unless explicitly authorized.
- Requested terminal and operational commands are allowed when they are needed to complete the task, but that permission never includes `git commit`, `git push`, or any other git history-changing action.
- Git write actions are always opt-in per occurrence. Never run `git commit`, `git push`, tag creation, branch creation, merge, rebase, reset, revert, stash, or other history-changing commands unless the user explicitly asks for that exact action in the current conversation.
- Commit or push approval is single-use and non-persistent. A prior approval to commit or push one set of pending changes does not authorize any later commit or push after additional edits, even within the same session.
- If the diff changes after approval was given, stop and ask again before committing or pushing. Treat each new batch of edits as requiring fresh authorization.
- Never infer that “commit the pending changes” grants standing permission for future commits. After completing one authorized commit or push, return to a no-commit, no-push default until the user explicitly requests it again.
- Before any authorized commit or push, summarize the exact files or change set being sent and the validation status. If validation has not been run, say so clearly and wait for confirmation if the request was ambiguous.
- Treat auth, permissions, Prisma schema, backup/restore, accounting, payroll, and inventory logic as high-risk areas. Validate those changes more aggressively.

## 2. Repository Shape

- Stack: Next.js 14 App Router, TypeScript strict mode, Prisma 5, PostgreSQL, NextAuth v4, React Query, Mantine, Zustand, Vitest, Playwright, Sentry.
- Main UI routes live in `src/app/**`.
- API routes live in `src/app/api/**`.
- Business-domain modules live in `src/modules/**`.
- Shared and platform code lives in `src/lib/**`, `src/core/**`, `src/components/**`, `src/services/**`, `src/utils/**`, and `src/shared/**`.
- Database structure is defined in `prisma/schema.prisma`.

## 3. Domain Model Expectations

- This repository serves multiple business areas in one application: clothing, general merchandise, trucking, household finance, and platform/admin.
- Clothing and general merchandise often follow parallel patterns. When changing one side, check whether the other side should also change or whether the difference is intentional and should be documented.
- Respect schema and domain boundaries. Do not assume all business areas share the same tables, workflows, or employee records.
- Preserve accounting and inventory invariants. If a change affects ledger movement, sale posting, reservations, payroll, or invoice/payment flows, verify the downstream effects before handoff.

## 4. Auth And Authorization

- Authentication is implemented with NextAuth credentials in `src/lib/auth/auth.ts`.
- Route protection is enforced in `src/middleware.ts`.
- `BYPASS_AUTH_FOR_TESTS=true` is a test-only escape hatch. Never depend on it for normal development or production behavior.
- When adding or changing protected routes, update all affected layers together: middleware access rules, server-side permission checks, and any permission-driven UI behavior.
- Do not weaken access control to make a feature easier to ship.

## 5. Module And Routing Conventions

- Follow the existing module/plugin pattern in `src/core/ModuleRegistry.ts` and related module infrastructure.
- New modules should align route registration, navigation metadata, business/workspace context, and permissions.
- Prefer the scaffold script for new modules:

```bash
npm run generate:module -- --name=<module-name> --domain=<clothing|general-merchandise|trucking|household|shared>
```

- Match existing naming conventions: folders in kebab-case, React components in PascalCase, and descriptive service/util names.

## 6. Database And Data Safety

- Prisma uses PostgreSQL with multiple schemas, including `public` and `general_merchandise`.
- Keep schema changes non-destructive. Avoid drops, truncations, destructive rewrites, or anything that can silently remove business data.
- Use `prisma db push` or `prisma migrate dev` only in safe local or test environments.
- Respect soft-delete patterns. Many models use `deletedAt`; do not replace soft deletes with hard deletes unless there is explicit approval and a recovery plan.
- Backup/restore scripts and database repair utilities are sensitive operations. If you touch them, document the risk and test only in safe environments.

## 7. Validation Standard

- During development, run the smallest relevant checks for fast feedback.
- Before handoff on meaningful code changes, the default quality gate is:

```bash
npm run guardrails:check
npm run lint
npm run typecheck
```

- If you touched shared logic, auth, API handlers, Prisma models, accounting, inventory, or cross-domain behavior, also run:

```bash
npm run test:unit
npm run test:integration
```

- If you changed security-sensitive or browser/runtime-sensitive behavior, also run:

```bash
npm run test:hardening
```

- Use `npm run test:coverage` when changing critical shared business logic or when you need regression confidence beyond targeted tests.
- Run Playwright E2E only when explicitly requested or when the changed behavior is primarily an end-to-end browser flow.
- Never disable tests, bypass guardrails, or lower coverage to force a pass.

## 8. Domain-Specific Validation Triggers

- Inventory or ledger changes: run `npm run inventory:ledger:controls` when relevant.
- Accounting transaction changes: run `npm run accounting:transactions:sanitycheck` when relevant.
- Module-system changes: verify registration, navigation visibility, and route access for each affected business/workspace context.

## 9. Documentation Rules

- Keep top-level navigation simple. The main entry points are `README.md` and `docs/README.md`.
- Business-domain documentation should remain discoverable through `docs/BUSINESS_LOGIC_INDEX.md`.
- Historical material belongs under the historical/reports structure, not mixed into current operational docs.
- When behavior, commands, routes, or policies change, update the relevant docs in the same change.
- Prefer plain English. Write so a new developer can follow the reasoning without guessing.

## 10. Traceability And Reviews

- If a commit is explicitly authorized, write a detailed commit message that explains what changed, why it changed, what areas were affected, and any follow-up risk.
- After code changes are complete, the default behavior is to stop at handoff. Do not perform commit, push, deploy, or other state-changing follow-up actions unless the user explicitly requests them again.
- If the user asks for a commit or push, apply that authorization only to the exact current state under discussion. Do not treat it as pre-approval for later changes, later fixes, or later sessions.
- Approval to run terminal commands, builds, tests, migrations, Docker commands, or deployments does not imply approval to commit or push. Commits and pushes always require their own explicit request and approval.
- In summaries, reviews, or PR notes, call out the validation you ran and any residual risk.
- If a requirement is unclear, clarify it before making broad architectural changes.

## 11. Quick Starting Points

- Project overview and commands: `README.md`
- Documentation hub: `docs/README.md`
- Contributor workflow: `CONTRIBUTING.md`
- Business-domain index: `docs/BUSINESS_LOGIC_INDEX.md`
- Verified architecture summary: `docs/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md`
- Full validated repo analysis: `Repo-Wide Analysis — Business Management System.md`

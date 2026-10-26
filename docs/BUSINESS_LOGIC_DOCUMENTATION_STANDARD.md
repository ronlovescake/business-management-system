# Business Logic Documentation Standard

This document defines how business logic should be documented in this repository.

The goal is not only to describe what the app does today, but to make the docs useful as the working contract for how the product is intended to behave.

---

## Primary Goals

1. Record the current operator-visible behavior of the application.
2. Show where the behavior comes from in the codebase.
3. Separate live behavior from placeholders, redirects, scaffolds, or planned behavior.
4. Make it clear when a module is intentionally incomplete.
5. Keep domain docs and platform docs aligned with the actual code paths.

---

## Required Business-Rule Change Protocol

This protocol applies system-wide: clothing, general merchandise, trucking,
household/personal finance, shared services, and platform behavior. It covers
changes to calculations, permissions, transitions, accounting/inventory effects,
UI actions, API handlers, jobs, imports, bulk operations, and data boundaries.
It does not require a separate rule for every line of code, and does not certify
all existing code as consistent. Every PR declares whether business behavior
changes; a refactor is not automatically non-business if its effects differ.

Before editing:

1. Identify the approved invariant and its canonical domain policy. Name the
   accountable business/domain owner and the code boundary that enforces it.
   User-approved policy is authoritative; observed code is evidence, not approval.
   If policy conflicts or is unknown, ask the owner rather than inventing a rule.
2. Trace the affected UI, server, background, bulk/import, cleanup and retry paths.
   Check shared consumers and sibling domains; explicitly mark unaffected paths
   with a reason. Record dependencies and financial/reconciliation risks.
3. Reuse the owning enforcement service where appropriate. UI restrictions must
   not replace server enforcement. Use transaction boundaries and database
   constraints where they fit the approved invariant; do not add schema changes
   or collapse distinct domains just to remove similar-looking code.

Before handoff/merge:

1. Test the invariant across relevant entry points, including failures, rollback,
   retries and races where applicable. Existing tests may be cited when adequate.
   Update the canonical domain contract in the same change when behavior changes.
2. Complete the marked JSON block in the PR template. For business changes,
   provide `owner`, `invariant`, `domains`, `policyPaths`, `affectedPaths`,
   `tests.paths`, `tests.results`, `docs.paths`, and `divergence.status/reason`.
   Paths are exact repository-relative references; policy/docs/test evidence must
   be files. For removed entry points, reference the surviving owner/directory
   and explain removed paths in Impact Analysis. No globs or URLs inside JSON.
3. Domain values are `clothing`, `general-merchandise`, `trucking`,
   `household-finance` (personal finance), `platform`, and `shared`. Include all
   affected domains; parallel domains may deliberately have different policies.
4. `divergence.status` is `none` or `intentional`. Explain sibling-domain effects
   even for `none`; intentional differences require `approvedBy` identifying the
   accountable decision-maker and policy decision. Unresolved decisions block
   completion. A name in JSON is a claim reviewers must verify, not approval proof.
5. If new test/doc evidence is genuinely inapplicable, replace that evidence
   object's `paths` with `exception` and `approvedBy`. Explain the rationale and
   decision; never bypass tests/coverage or claim unexecuted checks passed.
   `tests.results` must still explain the actual checks, outcomes, or non-execution.
6. For `businessRuleChange: false`, give a substantive `rationale` explaining why
   behavior is unchanged. Other fields may be removed. Reviewers must challenge
   misclassification and assess correctness of the record, not just green CI.

The validator rejects missing fields, blank/template answers, unresolved
divergence and invalid/outside-repository evidence paths. It does not prove
semantic correctness, full impact coverage, execution of cited tests, or approver
identity. Authoritative services, invariant tests, review and operational
reconciliation remain complementary controls, not replaced by this metadata gate.

### CI And Main Protection

`node scripts/check-business-rule-pr.js` runs in `guardrails:check` and skips
non-PR events. The separate PR-only `Business Rule Declaration` status runs on
opening, code updates, reopening, description edits and ready-for-review events.
It needs no npm install, GitHub token or application/database secrets. A PR-only
check prevents a successful push workflow (which skips metadata) from satisfying
the declaration requirement. Normal feature-branch pushes do not wait for CI.

`Guardrails + Validation` provisions a disposable PostgreSQL service using
`.env.test.example`, then resets and seeds that test database before integration
checks. The guarded test reset restores the investor-code sequence and reuses
the existing clothing and general-merchandise product-identity trigger SQL.
This test-only bootstrap is not a production migration procedure; it does not
certify deployment migrations or replace invariant tests.

The same bootstrap installs the five money-lifecycle CHECK constraints from the
new forward migration's canonical rules-only tail after `db push`. Prisma schema
alignment alone cannot install those PostgreSQL checks. Disposable fresh-database
tests verify both enforcement and the separation from column/table creation.

Repository code alone cannot prohibit direct pushes. After this workflow is
published and its checks exist, a repository admin must configure an active
GitHub rule targeting `main`:

- Require pull requests and the observed status checks `Business Rule Declaration`
  and `Guardrails + Validation` before merging; bind checks to GitHub Actions
  where supported. Confirm the actual names from a real PR, not workflow titles.
- Disallow bypass, including administrators where supported; keep force pushes
  and deletions blocked. Do not restrict normal feature-branch pushes.
- Preserve existing protection settings and review requirements; do not require
  an additional approving reviewer for a sole-maintainer repo without agreement.
- Verify settings via GitHub and confirm a PR cannot merge with missing/failing
  required checks. Do not test enforcement by attempting an unauthorized push.

This is the required target configuration, not a statement that remote settings
have already been enabled. Changing hosted settings needs admin access, may
depend on repository visibility/GitHub plan, and can be reversed by an authorized
admin. Without active protection (or with a bypass actor), direct pushes can
avoid the PR gate. Local hooks are convenience checks, not a security boundary.

---

## Documentation Layers

### 1. Index Layer

Files such as [docs/BUSINESS_LOGIC_INDEX.md](./BUSINESS_LOGIC_INDEX.md) should answer:

- what domains exist
- where each doc set lives
- what major module docs exist
- what still lacks detailed extraction

### 2. Coverage Layer

Files such as [docs/reports/archive/BUSINESS_LOGIC_COVERAGE_AUDIT_2026-04-08.md](./reports/archive/BUSINESS_LOGIC_COVERAGE_AUDIT_2026-04-08.md) should answer:

- which product surfaces are documented in detail
- which are only covered at overview level
- which are still missing or only scaffolded
- what the next documentation priority should be

### 3. Domain / Platform Overview Layer

Overview files should map:

- route roots
- API roots
- module/service roots
- the set of pages or workflows the area owns
- the current documentation status

### 4. Detailed Rule Layer

Detailed files should describe:

- validations
- formulas
- statuses and transitions
- filters, exports, redirects, and modal flows
- notifications, alerts, confirmations, and blocking conditions
- current limitations, placeholders, and caveats

---

## Required Structure For Detailed Docs

Every detailed business-logic doc should include the following where relevant:

1. Title naming the domain and module.
2. Source file list.
3. Numbered rule sections using the existing table format.
4. Current behavior only, unless a section explicitly states intended or planned behavior.
5. Explicit callouts for redirects, placeholder modules, local-only state, or incomplete persistence.

Preferred format:

```md
# Domain — Module Business Logic

> **Source files:**
>
> - `src/...`

## A — Section Title

| #   | Logic | Explanation           |
| --- | ----- | --------------------- |
| 1   | Rule  | Why / source / caveat |
```

---

## Current vs Intended Behavior

Distinguish the sources explicitly:

- Approved business policy is authoritative for intended behavior.
- Document observed implementation accurately as current behavior, including
  defects or differences from approved policy; do not redefine policy to match
  a bug. A source inspection alone does not prove deployed runtime behavior.
- Label approved-but-unimplemented and proposed behavior separately; proposals
  need approval before implementation. Never turn an undocumented assumption
  into policy by describing it as current behavior.

If a workflow is not yet fully implemented, the doc should say one of these explicitly:

- `Placeholder`
- `Scaffold only`
- `Redirect only`
- `Local-state-only`
- `Planned`

Do not describe future behavior as if it already exists.

---

## Ownership Model

Use these folders by default:

- `docs/business-logic/clothing/**` for clothing-specific logic
- `docs/business-logic/general-merchandise/**` for general-merchandise-specific logic
- `docs/business-logic/household-finance/**` for household / personal finance logic
- `docs/business-logic/trucking/**` for trucking-specific logic
- `docs/business-logic/platform/**` for auth, admin, backup/restore, settings, permissions, shared automation, and other cross-domain behavior

---

## Maintenance Rules

1. If a user-facing workflow changes, the affected business-logic doc must change in the same work item.
2. If a new module or route family is introduced, it must be added to the index and coverage audit.
3. If a workflow is intentionally placeholder-only, the doc must keep that explicit.
4. If a shared service drives multiple domains, each domain doc should still describe its route-level operator experience.

---

## API Contract Standard

All HTTP route handlers under `src/app/api/**` should follow the conventions
below. New module documentation (any `*-overview.md` or surface-level doc that
calls out endpoints) should reference this section instead of redescribing it.

### Response envelope

Every JSON response uses this envelope, defined in `src/types/api.ts`:

```ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string; // human-readable summary
  message?: string; // optional additional context
}
```

Error responses also set the appropriate HTTP status (4xx for client errors,
5xx for server errors). Prefer `src/lib/api/response.ts` and
`src/lib/api/normalize.ts` helpers over hand-rolled `NextResponse.json(...)`
calls so the envelope stays consistent.

### Pagination

List endpoints accept the standard query params and respond with the
`PaginatedResponse<T>` shape defined in `src/types/api.ts`:

| Param    | Default | Max   | Notes                           |
| -------- | ------- | ----- | ------------------------------- |
| `limit`  | `50`    | `500` | Page size; clamped server-side. |
| `offset` | `0`     | n/a   | Zero-based offset.              |

Response shape:

```ts
{
  success: true,
  data: T[],
  pagination: { page, limit, total, pages }
}
```

Endpoints that return a single record or a small fixed set are exempt.

### Validation

Every `POST`, `PUT`, and `PATCH` route MUST validate its body with a Zod
schema before touching the database. On a validation failure return HTTP 400
with field-level details in the envelope's `error` and (where helpful)
`validationErrors` fields.

### Logging and errors

Wrap handlers with the logging helper exported from `src/lib/api/` (see the
API logging wrapper introduced in `IMPROVEMENTS_CHECKLIST.md` \u00a710) so every
request emits a structured log line and uncaught errors are normalized to the
envelope and forwarded to Sentry with module/domain context.

### Documentation expectation

When a business-logic doc lists API routes, prefer one of:

1. A short table referencing the standard (no need to restate the envelope), or
2. A pointer to this section.

Describe deviations from the API standard explicitly, with the rationale.
Keep approved business policy separate from observed implementation and proposed
behavior. Neither an API-standard deviation nor an existing implementation
authorizes an undocumented business-policy change.

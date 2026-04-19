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

The default rule is:

- document **current live behavior** as authoritative
- document **intended / target behavior** only when clearly labeled

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

Only describe deviations from the standard explicitly, with the rationale. 5. The docs should reflect what the codebase is supposed to do as embodied by the current implementation and explicitly documented intended states, not unwritten assumptions.

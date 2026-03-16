# Debugging Guide

This repository now includes VS Code debugger profiles for Next.js, API routes, Vitest, and Playwright.

## Ports

- App dev server: `http://localhost:5001`
- Playwright dev server: `http://localhost:3100`
- Node inspector: `9229`

## Recommended Workflows

### Next.js page and server debugging

Use the VS Code launch profile:

- `Next.js: full-stack debug`

This starts the Webpack-based Next.js dev server on port `5001` and opens a browser debug session against the same app.

Use this when you need to step through:

- client page code
- server-rendered page code
- shared hooks and data transforms used by the page

### API route debugging

Use the VS Code launch profile:

- `Next.js: API routes`

This starts the inspected Next.js dev server through the background task:

- `Next.js dev server (inspect)`

Set breakpoints in `src/app/api/**/route.ts`, then hit the route from the UI, browser, or a request client.

### Vitest debugging

Use one of these launch profiles:

- `Vitest: current file (unit/jsdom)`
- `Vitest: current file (integration/node)`
- `Vitest: full unit suite`

Use the unit profile for React and `jsdom` tests. Use the integration profile for `tests/integration/**` and any server-side flow that depends on the Node test environment.

### Playwright UI debugging

Use one of these launch profiles:

- `Playwright: current file (chromium)`
- `Playwright: full UI debug`

The browser profile uses the background task:

- `Playwright dev server 3100`

This runs the Playwright-oriented Next.js dev server on port `3100` with `.env.test` and test-auth bypass enabled.

## When To Use a Debugger

Use the debugger when a failure already exists and you need to explain the runtime behavior.

Good fits:

- a test fails but the wrong branch or state change is not obvious
- an API route returns the wrong payload shape
- a React page shows stale or unexpected data
- auth, cache, mutation, or request timing looks wrong
- a regression appears only under real navigation or full UI flow

Less useful fits:

- broad regression prevention across many scenarios
- simple type or lint failures
- issues that are already fully explained by logs or assertions

## Regression Strategy

Use the tools together, not as substitutes:

1. Tests detect regressions.
2. Debuggers localize and explain regressions.
3. Logs and diagnostics help confirm the fix.

For this repo, the practical split is usually:

1. `Vitest` for unit and integration regression checks
2. `Playwright` for end-to-end UI regressions
3. VS Code debugger when one of those signals a behavioral change that needs runtime inspection

## How To Run Regression Checks

Use the smallest check that can prove or disprove the suspected regression, then widen only if needed.

### 1. Run one targeted unit or logic test first

Use this when the suspected regression is in a pure function, calculation, mapper, or hook helper.

Example from this repo:

```bash
npm run -s test -- --run src/lib/payroll/__tests__/deductions.test.ts
```

This is the fastest way to check whether a logic change broke a known behavior without paying for the full suite.

### 2. Run the relevant test family next

Use the built-in scripts when the issue spans more than one file:

```bash
npm run test:unit
npm run test:integration
npm run test:hardening
npm run test:e2e:chromium
```

Use these based on the failure shape:

- `test:unit` for isolated logic and component behavior
- `test:integration` for API and multi-layer server flows
- `test:hardening` for stricter regression and edge-case coverage
- `test:e2e:chromium` for real browser workflows

### 3. Run the full quality chain before finalizing a risky fix

Use this when the change touches shared logic, business rules, or broad app behavior.

```bash
npm run test:full
```

That runs:

1. lint
2. typecheck
3. unit tests
4. integration tests
5. hardening tests
6. coverage tests

### 4. Use the debugger only after a check fails or behavior is reproducibly wrong

Use the matching VS Code profile after a test failure, parity diff, or manual repro gives you a concrete signal.

- logic test failing: `Vitest: current file (unit/jsdom)`
- API/server behavior failing: `Next.js: API routes`
- browser-only behavior failing: `Playwright: full UI debug`

### 5. For manual regression checks, reproduce with the right runtime

Use the runtime that matches the failure:

- app behavior on normal dev server: `npm run dev`
- browser-test behavior: `npm run dev:playwright`

Then reproduce the exact steps that changed and keep the debugger attached only if the issue is already visible.

## Breakpoint Recipes

### API payload mismatch

Use this when the UI receives the wrong shape, missing fields, or unexpected status values.

Recommended flow:

1. Start `Next.js: API routes`.
2. Put a breakpoint at the route entry in the affected handler under `src/app/api/**/route.ts`.
3. Put a second breakpoint immediately before the `return NextResponse.json(...)` or equivalent response mapping.
4. Trigger the request from the UI or browser.
5. Compare the incoming request payload, the mapped service result, and the final JSON response.

Good places to start in this repo:

- `src/app/api/thirteenth-month-pay/route.ts`
- `src/app/api/dispatch/orders/route.ts`
- `src/app/api/invoices/route.ts`

What usually reveals the regression:

- request parsing differs from what the client sends
- a service layer returns a field under a different name
- a fallback or default path overwrites the real value
- response mapping drops a field or changes its type

### React Query stale data or mutation regression

Use this when a page renders old data after create, edit, approve, or delete actions.

Recommended flow:

1. Start `Next.js: full-stack debug`.
2. Put breakpoints in the relevant page hook around the mutation lifecycle.
3. Focus on `onMutate`, `onSuccess`, `onError`, and `invalidateQueries` / `setQueryData` calls.
4. Trigger the UI action.
5. Check whether the query key used for reads matches the query key used for invalidation or optimistic updates.

Good places to start in this repo:

- `src/app/clothing/employees/payroll/hooks/usePayroll.ts`
- `src/app/trucking/employees/payroll/hooks/usePayroll.ts`
- `src/app/clothing/employees/payroll/hooks/payrollCsvImport.ts`
- `src/app/trucking/employees/payroll/hooks/payrollCsvImport.ts`

What usually reveals the regression:

- the page reads from one query key but invalidates another
- optimistic updates write a partial object that the UI cannot fully render
- mutation success returns later than expected and stale cache wins temporarily
- the API call succeeds but the page store never recomputes derived state

### Test fails but app behavior looks fine

Use this when `Vitest` fails on a specific branch or state transition that is hard to see from assertions alone.

Recommended flow:

1. Start `Vitest: current file (unit/jsdom)` or `Vitest: current file (integration/node)`.
2. Break on the failing branch inside the implementation under test, not just in the test file.
3. Step through the values that feed the failing assertion.
4. Confirm whether the test expectation is outdated or the implementation drifted.

This is especially useful for parity and calculation regressions where logs show final values but not the intermediate branch that produced them.

### Playwright regression that only appears during real navigation

Use this when a bug appears only after full routing, auth bypass, or real browser interaction.

Recommended flow:

1. Start `Playwright: full UI debug`.
2. Put breakpoints in the page hook, component event handler, or API route involved in the failing flow.
3. Reproduce the issue through the browser while Playwright drives the scenario.
4. Inspect the exact state transition or request that diverges from expectation.

This is the right tool when the failure depends on:

- navigation order
- browser timing
- focus or event sequencing
- query invalidation after a real user action

## Where To Break First

When you are not sure where to start, use this order:

1. request entry or event handler
2. first transform or validation step
3. mutation `onSuccess` or `onError`
4. cache update or invalidation call
5. final derived state used by the rendered UI

If you break only at the final rendered component, you are usually too late to explain the regression cleanly.

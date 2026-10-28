# Clothing - Employee Handbook Page

## Ownership And Scope

The requesting Clothing business owner approved an authenticated, read-only
Operations handbook for ordinary staff, with module navigation, search and
curated Accounting guidance. The approved invariant is that learning about an
Accounting procedure must not grant access to Accounting screens or actions.
Employees/HR, other businesses, financial calculations and stored business data
are unchanged. There is no editor, CMS, import, job, bulk operation or handbook API.

Employee text remains in the [Master SOP Manual](operations-workflow.md).
Accounting interpretation remains in the [accounting policy](../../OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md)
and the owning [Accounting contracts](accounting-overview.md); this document is
the page's technical contract, not another employee manual.

## Source Files

- `src/app/clothing/operations/handbook/page.tsx`
- `src/modules/clothing/operations/handbook/HandbookPage.tsx`
- `src/modules/clothing/operations/handbook/handbook.ts`
- `src/modules/clothing/operations/handbook/parseHandbook.ts`
- `src/modules/clothing/operations/handbook/loadHandbook.server.ts`
- `src/components/navigation/navigationItems.ts`
- `src/core/routePermissions.ts`
- `next.config.js`
- `Dockerfile`

## Page And Access Rules

| #   | Rule                  | Behavior                                                                                                                                                                                                          |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Route                 | `/clothing/operations/handbook`, linked as Employee Handbook only in Clothing Operations.                                                                                                                         |
| 2   | Authentication        | Middleware and the server page require USER, ADMIN or SUPER_ADMIN. The page rejects anonymous/unsupported users before loading content.                                                                           |
| 3   | Staff guidance access | The page intentionally does not require a database module grant. It provides text only and does not change `hasModuleAccess`, other pages, APIs or permission-driven controls.                                    |
| 4   | Existing restrictions | Accounting, HR, supplier resolution and financial posting retain their existing administrator requirements. Reading a procedure cannot execute it.                                                                |
| 5   | Module groups         | Operations and Accounting. Getting Started covers common safety and escalation. No HR or sibling-business content is included.                                                                                    |
| 6   | Search                | Case-insensitive, all-word matching across ID, title, module/group labels and procedure text, optionally restricted to one module. Empty results have a clear-filters action.                                     |
| 7   | Reading               | Module sidebar on wide screens, module selector on smaller screens, procedure list and detail pane. Phones use a browse drawer. Tables scroll within the content when necessary.                                  |
| 8   | Procedure links       | Stable fragment IDs such as `#E13` and `#A04`, related-procedure links, Previous/Next and copy-link feedback. Selection focuses the procedure heading; browser history restores the linked procedure.             |
| 9   | Unavailable links     | Unknown IDs display a nonblocking notice. Invalid canonical Markdown procedure links fail validation instead of shipping silently broken links.                                                                   |
| 10  | Financial limits      | Existing approval requirements, incomplete-cost warnings and unresolved expense-history/Bank Fees findings remain explicit. No balancing amounts, guessed legacy dates or unsupported corrections are introduced. |

## Canonical Content Format

An explicitly reviewed metadata comment immediately precedes each published
heading in the master manual:

```md
<!-- handbook: {"id":"E01","modules":["products","shipments"],"kind":"issue"} -->

### E01: A Whole Product Moves To A Later Shipment
```

- IDs are unique, stable uppercase identifiers. Existing E01-E22 and Markdown
  heading anchors are preserved. S01-S12 identify normal stages, F01-F27 the
  existing FAQs, and A01-A10 curated Accounting procedures.
- `modules` uses the reviewed catalog in `handbook.ts`; intentional multiple
  memberships make one procedure discoverable without copying its text.
- `kind` is `workflow`, `issue`, `reference` or `accounting`.
- Nested headings stay in their parent procedure. The next tagged procedure or
  same/higher untagged heading ends it. Untagged introductions and developer
  maintenance sections are not published as procedures.
- Marked parses Markdown; DOMPurify limits rendered tags and attributes. Only
  stable handbook fragment links remain actionable. Internal developer-document
  links become ordinary text, not public Markdown downloads or broken app URLs.
- The loader validates IDs, modules, nonempty bodies and related links. Content
  errors fail visibly on the server rather than substituting an empty manual.

## Runtime Packaging

The server reads only `docs/business-logic/clothing/operations-workflow.md` and
passes sanitized procedure data to the client. The raw Markdown is not placed
under `public/`; there is no public source endpoint. Next file tracing includes
that exact file for the route, and the Docker runtime explicitly copies it.
Documentation edits therefore ship with the application release. No second
hand-maintained TypeScript/JSON content copy or runtime database is required.

DOMPurify remains an external server-component dependency so its Node DOM
implementation can resolve its runtime assets instead of looking inside a
Webpack bundle. Development-only previews can set `BMS_DEV_DIST_DIR` to isolate
their Next cache; production keeps `.next` regardless of that variable.

## Validation And Remaining Limits

Focused content, UI and route suites cover all 74 procedures, module coverage,
duplicate/invalid metadata, sanitization, search, empty results, related links,
history, mobile selection, clipboard failure, anonymous/staff roles and unchanged
privileged routes. Existing Clothing API authorization tests also pass.

`node tests/e2e/clothing-handbook.browser.cjs` renders the canonical source in an
isolated browser fixture without business-data requests or default database
setup. Desktop 1440px, tablet 1024px, phone 390px and narrow-phone 320px checks
pass for search, module selection, mobile browsing, deep links, keyboard focus,
history, clipboard and viewport/button fit. Screenshots were inspected.

The live Next.js route also returns HTTP 200 for USER, ADMIN and SUPER_ADMIN,
redirects anonymous requests to login, and retains staff redirects from
Accounting Ledger and HR Payroll. Full-shell desktop/phone hydration, search
and viewport fit pass with temporary in-memory test sessions and intercepted
header API fixtures. No business users or records were created for this smoke check.

Whole-repository lint and typecheck pass, as do 4,532 unit tests, 90 integration
tests and 12 hardening tests. Integration used an owned disposable database,
removed and verified absent afterward. Focused handwritten checks also validate
the declaration and documentation links.

`guardrails:check` remains blocked by file-size limits: this canonical manual
exceeds the threshold, and the unchanged reconciliation report is also over the
limit. No size override or threshold reduction was used. The remaining
command-drift, generated ACL, module ACL, script-manifest and backup-schema
subchecks pass. Resolving the oversized documentation requires a separate
documentation-structure decision, not an unrelated report rewrite in this feature.

No production build, Docker image build, migration, production operation, commit
or deployment is authorized by this feature. Packaging declarations are tested;
this is not evidence that a production image has been rebuilt or deployed.

## Business-Rule Record

<!-- business-rule-change -->

```json
{
  "businessRuleChange": true,
  "owner": "Requesting Clothing business owner; ordinary-staff read access and scope approved before implementation",
  "invariant": "Authenticated USER, ADMIN and SUPER_ADMIN may read the Clothing handbook without a module grant; Accounting, HR and financial-action permissions remain unchanged.",
  "domains": ["clothing", "platform"],
  "policyPaths": [
    "docs/business-logic/clothing/operations-handbook.md",
    "docs/business-logic/clothing/operations-workflow.md",
    "docs/business-logic/clothing/accounting-overview.md"
  ],
  "affectedPaths": [
    "src/app/clothing/operations/handbook/page.tsx",
    "src/modules/clothing/operations/handbook",
    "src/components/navigation/navigationItems.ts",
    "src/core/routePermissions.ts",
    "next.config.js",
    "Dockerfile"
  ],
  "tests": {
    "paths": [
      "src/modules/clothing/operations/handbook/__tests__/handbook.test.ts",
      "src/modules/clothing/operations/handbook/__tests__/HandbookPage.test.tsx",
      "src/modules/clothing/operations/handbook/__tests__/HandbookRoute.test.tsx",
      "tests/unit/api/clothing-api-authorization.test.ts"
    ],
    "results": "Focused content (6), UI (5), route (7) and existing API authorization (22) checks passed. Isolated browser checks passed at 1440, 1024, 390 and 320 pixels. Whole-repository lint, typecheck, 4532 unit tests, 90 integration tests and 12 hardening tests passed. Scratch database cleanup was verified. guardrails:check failed on oversized canonical manual and unchanged reconciliation report; remaining guardrail subchecks passed without overrides."
  },
  "docs": {
    "paths": [
      "docs/business-logic/clothing/operations-handbook.md",
      "docs/business-logic/clothing/operations-workflow.md",
      "docs/business-logic/clothing/business-overview.md",
      "docs/business-logic/clothing/accounting-overview.md",
      "docs/BUSINESS_LOGIC_INDEX.md"
    ]
  },
  "divergence": {
    "status": "intentional",
    "reason": "The owner explicitly limited v1 to Clothing Operations and Accounting guidance. General Merchandise, Trucking, Household and Employees/HR retain their current navigation, data boundaries and authorization. No financial or inventory enforcement changes.",
    "approvedBy": "Requesting Clothing business owner, approved Clothing-only ordinary-staff handbook implementation"
  }
}
```

<!-- /business-rule-change -->

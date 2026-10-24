## Summary

Describe the change and why it is needed.

## Business-Rule Change Record

Follow [the business-rule protocol](../docs/BUSINESS_LOGIC_DOCUMENTATION_STANDARD.md).
Set `businessRuleChange` to `true` or `false`. Every PR needs a declaration.
For `false`, explain why business behavior is unchanged in `rationale`; the other
fields can be removed. For `true`, complete every field below. Use exact
repository-relative paths, not URLs, globs, or Markdown links inside JSON.

Domains: `clothing`, `general-merchandise`, `trucking`, `household-finance`
(personal finance), `platform`, `shared`. Include every affected domain.

<!-- business-rule-change -->

```json
{
  "businessRuleChange": null,
  "rationale": "",
  "owner": "",
  "invariant": "",
  "domains": [],
  "policyPaths": [],
  "affectedPaths": [],
  "tests": {
    "paths": [],
    "results": ""
  },
  "docs": {
    "paths": []
  },
  "divergence": {
    "status": "",
    "reason": "",
    "approvedBy": ""
  }
}
```

<!-- /business-rule-change -->

`owner` names the accountable business/domain maintainer and the owning code
boundary. `policyPaths` identifies approved policy, not a new assumption inferred
from code. `affectedPaths` may include directories; describe removed paths and
all UI/API/job/import/bulk entry points in the impact analysis below.

`tests.paths` lists existing test/spec files; `tests.results` records checks and
actual results, or honestly states what was not run and why. `docs.paths` lists
existing Markdown contracts. If tests or docs genuinely need no new evidence,
replace that object's `paths` with `exception` and `approvedBy`, both explaining
the reason/decision. Existing unchanged tests and docs can be referenced.

`divergence.status` is `none` or `intentional`; explain sibling-domain impact in
`reason`, and identify the decision-maker in `approvedBy` for intentional
differences. Resolve unknown policy before merging. CI checks completeness and
paths, not the truth of the answers or the identity/authority of approvers.

## Impact Analysis

List affected entry points, shared consumers, intentional domain differences,
failure/retry/concurrency behavior, and rollback or reconciliation risks.

## Review

- [ ] Approved policy and owning enforcement code were identified before editing.
- [ ] UI, server, background jobs, bulk/import and parallel-domain paths agree.
- [ ] Tests exercise the invariant, not just a single implementation path.
- [ ] Documentation and intentional exceptions match the approved decision.
- [ ] Actual verification results and remaining risks are recorded.

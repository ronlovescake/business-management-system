# Platform — Shared Employee Automation

This file documents the shared employee automation logic that serves multiple business domains.

> **Primary route roots:** `src/app/employees/_shared/**`
>
> **Primary shared roots:** `src/modules/shared/employees/automation/**`, `src/modules/shared/employees/api/**`

---

## Covered Workflow Families

1. automation settings and save behavior
2. scheduler timing and catch-up behavior
3. internal automation route invocation
4. stay-in automation and related background execution rules

---

## Notes For The Detailed Pass

- This document should describe the operator-facing settings workflow and the business meaning of the scheduler knobs, not just the internal implementation.
- Domain-specific behavior that differs between clothing, general-merchandise, and trucking should still be documented in the corresponding domain doc when the operator experience diverges.
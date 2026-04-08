# Platform — User Management And Permissions

This file is the documentation seed for cross-domain user management and permission logic.

> **Primary shared roots:** `src/modules/shared/user-management/**`
>
> **Primary data roots:** `users`, `modules`, and `user_permissions` models in Prisma / services

---

## Covered Workflow Families

1. user creation and activation state
2. module-level permission assignment
3. permission-tree presentation and editing
4. admin-facing user management panels and modals

---

## Notes For The Detailed Pass

- This document should eventually capture role defaults, module access inheritance, activation/deactivation rules, and operator-visible permission editing behavior.
- It should stay platform-scoped because the permission system governs all domains rather than a single business unit.
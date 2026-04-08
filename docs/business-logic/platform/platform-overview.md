# Platform / Shared Logic Overview

This directory documents the cross-domain **platform**, **admin**, **auth**, and **shared-service** logic that does not belong to a single business unit.

> **Primary route roots:** `src/app/admin/**`, `src/app/settings/**`, `src/app/login/**`, `src/app/profile/**`
>
> **Primary API roots:** `src/app/api/backup/**`, `src/app/api/restore/**`, `src/app/api/modules/**`, `src/app/api/settings/**`
>
> **Primary shared module roots:** `src/modules/shared/**`, `src/lib/auth/**`
>
> **Docs root:** `docs/business-logic/platform/`

---

## What Belongs Here

- authentication and access control
- admin backup / restore workflows
- settings and configuration that apply across domains
- change-log and version-history workflows
- module marketplace and module operations
- internal user messaging and conversations
- shared employee automation and other infrastructure logic reused across business units

---

## Module Index

| Area | Doc File | Description |
| --- | --- | --- |
| Platform overview | [platform-overview.md](./platform-overview.md) | Scope definition and source-root map for cross-domain logic. |
| Auth and access | [auth-and-access.md](./auth-and-access.md) | Login, session, redirect, password reset, profile, and permission rules. |
| Admin backup and restore | [admin-backup-restore.md](./admin-backup-restore.md) | Backup creation, inspection, restore-runner, and operator-managed restore behavior. |
| Settings and configuration | [settings-and-configuration.md](./settings-and-configuration.md) | Global settings, invoice settings, transaction settings, accounting settings, and payment cards. |
| Change log and version history | [change-log-and-version-history.md](./change-log-and-version-history.md) | Change tracking, change-log redirects, and current version-history persistence limits. |
| User management and permissions | [user-management-and-permissions.md](./user-management-and-permissions.md) | Users, roles, module permissions, and admin permission workflows. |
| Module marketplace and module operations | [module-marketplace-and-module-operations.md](./module-marketplace-and-module-operations.md) | Module registry, install/update/reload/config flows, and marketplace download rules. |
| Internal messaging and conversations | [internal-messaging-and-conversations.md](./internal-messaging-and-conversations.md) | Conversation creation, unread state, and internal user messaging workflows. |
| Shared employee automation | [shared-employee-automation.md](./shared-employee-automation.md) | Scheduler, automation settings, and internal employee automation flows. |

---

## Coverage Notes

- Auth, settings, module operations, change-log/version history, and internal messaging are now documented at rule level in this folder.
- Backup / restore is already documented in detail because it is a platform-owned destructive workflow.
- Shared employee automation and some user-management details still warrant a deeper pass where the scheduler or permission model changes materially.
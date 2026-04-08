# Platform — Module Marketplace And Module Operations

> **Source files:**
>
> - `src/app/api/modules/route.ts`
> - `src/app/api/modules/install/route.ts`
> - `src/app/api/modules/uninstall/route.ts`
> - `src/app/api/modules/update/route.ts`
> - `src/app/api/modules/reload/route.ts`
> - `src/app/api/modules/download/route.ts`
> - `src/app/api/modules/config/route.ts`
> - `src/app/api/modules/config/[moduleId]/route.ts`
> - `src/app/api/modules/performance/route.ts`
> - `src/app/api/marketplace/modules/route.ts`
> - `src/core/PluginManager`
> - `src/core/ModuleHMR`
> - `src/core/ModulePerformance`

---

## A — Module Registry Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | The platform keeps a hardcoded app-module registry | `APP_MODULES` defines module identity, display name, path, category, description, and ordering. |
| 2 | Modules can be hierarchical | A module may reference a `parentName`, which lets the registry express nested module structure. |
| 3 | Module listing is permission-aware at read time | The modules API returns the registered module list filtered through the user's access rules. |

---

## B — Installed Module Configuration Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 4 | Installed-module config is stored in the `installedModule` table | The config APIs persist module package metadata and enabled state in a dedicated table. |
| 5 | Config writes are upserts keyed by `moduleId` | Saving module configuration replaces or creates the module record rather than inserting duplicates. |
| 6 | Required module config fields are `id`, `name`, and `version` | Missing any of these fields causes the save to be rejected. |
| 7 | Module identifiers and metadata are sanitized before persistence | Module IDs, names, versions, and related path/source fields are normalized by the route layer. |
| 8 | Config GET returns all installed modules in reverse install/update order | The config list is ordered by `installedAt` descending. |
| 9 | Config list reads fail open to an empty array when the table is not ready | The route explicitly returns `[]` on the missing-table Prisma error instead of treating that case as fatal. |
| 10 | Per-module config lookup returns `404` when the module record does not exist | The by-ID route does not fabricate defaults for unknown module IDs. |
| 11 | Per-module delete is a hard removal of the installed-module record | Deleting a config removes the stored module configuration entry directly. |

---

## C — Module Lifecycle Operation Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 12 | Module install accepts `moduleId` with optional `version`, `force`, and `skipDependencies` flags | Installation is a controlled lifecycle action rather than a freeform package upload. |
| 13 | Install rejects already installed modules unless `force=true` | The route returns a conflict-style response for duplicate installation attempts. |
| 14 | Module update requires a module ID and initializes the plugin manager first | The update route explicitly initializes the manager before calling `updateModule()`. |
| 15 | Updating a not-installed module returns a not-found style error path | The update route maps `NOT_INSTALLED` into a `404` response. |
| 16 | Module reload is the HMR-oriented operational refresh endpoint | Reload POST requires a module ID and returns whether the reload succeeded, plus duration and message/error context. |
| 17 | Module reload also exposes runtime statistics | Reload GET returns HMR statistics and pending reloads for operational visibility. |

---

## D — Download, Marketplace, And Performance Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 18 | Module downloads are restricted to HTTPS URLs | The download route blocks non-HTTPS sources. |
| 19 | Module downloads block private-network targets | The route rejects localhost and private IP ranges to reduce SSRF-style abuse. |
| 20 | Download size and runtime are capped | The current route limits module downloads to 10 MB and a 30-second timeout. |
| 21 | Marketplace downloads can verify checksum when supplied | A provided checksum becomes part of the download validation contract. |
| 22 | Downloaded marketplace artifacts are stored under `modules/marketplace/<moduleId>/` | The marketplace flow preserves a module-specific local storage path. |
| 23 | Marketplace listing only exposes published modules | Search and sort operate on the published catalog rather than on drafts or unpublished entries. |
| 24 | Marketplace search spans name, description, and keywords | Search and category filtering are both catalog-level behaviors. |
| 25 | Module performance GET supports whole-platform and per-module reports | The route returns either a full export or metrics for a requested module ID. |
| 26 | Module performance POST supports optimization and cache-control actions | Supported actions are `optimize`, `warmCache`, `preload`, `prefetch`, and `clear`. |
| 27 | `preload` and `prefetch` require a specific module ID | The performance route rejects those actions when no module is targeted. |

---

## E — Current Caveats

| # | Logic | Explanation |
| --- | --- | --- |
| 28 | Core plugin, HMR, and performance behavior lives below the route layer | These docs describe the API-facing contract; deeper runtime behavior still depends on the core module system implementation. |
| 29 | Module operations span registry, install state, runtime refresh, and performance tooling | Operators and maintainers should treat this as one platform capability with several distinct persistence and execution paths. |
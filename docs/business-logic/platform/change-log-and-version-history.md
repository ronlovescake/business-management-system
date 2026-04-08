# Platform — Change Log And Version History

> **Source files:**
>
> - `src/app/admin/change-log/page.tsx`
> - `src/app/api/change-log/route.ts`
> - `src/app/api/clothing/operations/settings/change-log/route.ts`
> - `src/app/api/version-history/route.ts`
> - `src/app/api/version-history/sync/route.ts`
> - `src/modules/clothing/operations/settings/change-log/**`
> - `src/core/change-log/change-log.service.ts`
> - `prisma/schema.prisma`

---

## A — Routing And Ownership Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | The old global change-log route is deprecated | `/api/change-log` now returns `410 Gone` and points clients to the newer settings-owned change-log path. |
| 2 | The current active change-log API lives under the clothing settings route tree | The main audited endpoint is `/api/clothing/operations/settings/change-log`. |
| 3 | The admin change-log page is a redirect entry point, not an independent UI implementation | `/admin/change-log` forwards operators into the current settings-owned history surface. |

---

## B — Change Log Data Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 4 | Change-log records are field-aware audit entries | The model stores entity type, entity ID, action, field, old value, new value, source, and metadata. |
| 5 | Change-log entries can be user-attributed | User ID and user name may be attached when the change is tied to an operator. |
| 6 | Change-log actions support both row-level and broader operational events | The model accommodates actions such as create, update, delete, import, export, and restore. |
| 7 | Change-log data is indexed for chronology and filtering | The schema indexes `createdAt`, `entityType`, and `userId` for audit retrieval. |

---

## C — Change Log Query And UI Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 8 | Change-log reads require authentication | The current settings-owned history endpoint calls shared auth enforcement before returning logs. |
| 9 | Change-log queries support broad operator filtering | Supported filters include page, limit, search, entity type, entity ID, user, action, source, and date range. |
| 10 | Default page size is `25` and maximum page size is `200` | The API guards against unbounded history reads. |
| 11 | Distinct filter lists are part of the API contract | The endpoint can return filter values for UI dropdowns alongside the paginated data. |
| 12 | The UI supports both table and timeline views | Operators can read change history as a structured grid or a chronological narrative. |
| 13 | The UI highlights changed values and extracts meaningful metadata | Display logic surfaces more readable field labels and context such as names or product codes when metadata allows it. |

---

## D — Version History Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 14 | Version-history backend persistence is not finished yet | The current GET route returns an empty array and the sync route is explicitly marked as deferred persistence. |
| 15 | The active version-history experience is still client-side | Current comments and route behavior indicate IndexedDB remains the practical storage mechanism today. |
| 16 | Sync payloads are accepted as a forward-compatibility contract | The sync route accepts `dataKey`, `versions`, and timestamp-shaped data even though durable server persistence is deferred. |

---

## E — Current Caveat

| # | Logic | Explanation |
| --- | --- | --- |
| 17 | Operators should treat change log as authoritative, but version history as partially scaffolded | Change log is implemented as a real audit surface; version history still exposes placeholder API behavior. |
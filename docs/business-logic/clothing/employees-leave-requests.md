# Clothing — Leave Requests Business Logic

> **Source files:**
>
> - `src/modules/clothing/employees/leave-requests/api/service.ts` (thin wrapper)
> - `src/shared/employees/leave-requests/api/serviceBase.ts`

---

## A — Bulk Create Validation

| #   | Logic                                                                   | Explanation                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All employee IDs in a batch are validated before any record is inserted | `LeaveRequestServiceBase.createMany` resolves every `employeeId` in the incoming array against the database before writing anything. This is an all-or-nothing pre-flight check.                         |
| 2   | The error response lists exactly which employee IDs were not found      | If one or more employees cannot be resolved, the service returns a structured error listing the missing IDs rather than throwing a generic exception. This helps operators identify and fix bad imports. |
| 3   | No partial batch inserts occur                                          | If any employee ID is invalid, zero records are created for the entire batch.                                                                                                                            |

---

## B — Overlap Detection

| #   | Logic                                                        | Explanation                                                                                                                                        |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | Overlapping leave dates for the same employee are rejected   | `checkOverlappingLeaves` queries the repository for any existing approved leave for the employee that overlaps the requested date range.           |
| 5   | An `excludeId` parameter allows update scenarios             | When editing an existing leave request, passing its own `id` as `excludeId` prevents the overlap check from flagging the record against itself.    |
| 6   | Overlap is detected at the repository layer, not in the hook | The check is performed within the service base, not in the UI or API handler — ensuring the guard applies regardless of how the service is called. |

---

## C — Module Delegation

| #   | Logic                                                | Explanation                                                                                                                                |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 7   | The Clothing leave-request service is a thin wrapper | `src/modules/clothing/employees/leave-requests/api/service.ts` extends `LeaveRequestServiceBase` without adding any module-specific logic. |
| 8   | The shared base supports multiple business modules   | Other business units (GM, Trucking, etc.) can extend `LeaveRequestServiceBase` and override methods for module-specific leave policies.    |

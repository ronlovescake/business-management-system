# Transactions Status Hardening

Date: 2026-01-20

## Summary

This change centralizes order-status handling and makes shipment-status mapping more defensive without changing the operations workflow.

## What Changed

- Added shared order-status helpers so the Transactions module uses a single normalization path:
  - `normalizeOrderStatus()`
  - `isCancelledOrderStatus()` (Cancelled only)
- Added unknown shipment-status logging to detect new or unexpected shipment statuses while keeping the default behavior (In Transit fallback).
- Statistics calculations now use normalized status comparisons instead of ad-hoc string checks.

## Rationale

- Prevents silent status drift across UI, reporting, and validation logic.
- Keeps the current workflow intact (blank shipment status still treated as in transit).
- Makes future status additions visible via logs instead of changing behavior silently.

## Impact

- No changes to accounting logic or inventory calculations.
- No changes to user-facing status options; “Cancelled” remains the only cancellation status.

## Files Touched

- src/modules/clothing/operations/transactions/services/TransactionService.ts
- src/lib/transactions/order-status.ts

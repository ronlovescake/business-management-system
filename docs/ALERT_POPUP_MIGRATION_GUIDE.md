# Alert & Popup Migration Guide

## Overview

This document provides a comprehensive analysis of all alert/popup patterns used throughout the application and provides guidance for migrating to a unified SweetAlert2-based system.

**Date Created:** November 2, 2025  
**Current Status:** In Progress  
**Migration Tool:** `/src/lib/alerts.ts`

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Alert Patterns Found](#alert-patterns-found)
3. [Migration Strategy](#migration-strategy)
4. [New Centralized System](#new-centralized-system)
5. [Migration Examples](#migration-examples)
6. [Files to Update](#files-to-update)
7. [Testing Checklist](#testing-checklist)

---

## Current State Analysis

### Summary

The application currently uses **THREE different alert/popup systems**:

1. **Native Browser Alerts** (`alert()`, `confirm()`) - **52+ instances**
2. **SweetAlert2** (`Swal.fire()`) - **48 instances**
3. **Mantine Notifications** (`notifications.show()`) - **100+ instances**

### Distribution by Type

| Pattern Type           | Count | Files     | Status             |
| ---------------------- | ----- | --------- | ------------------ |
| Native `alert()`       | 45+   | 12+ files | ❌ Needs Migration |
| Native `confirm()`     | 7+    | 4+ files  | ❌ Needs Migration |
| `Swal.fire()`          | 48    | 10 files  | ⚠️ Standardize     |
| `notifications.show()` | 100+  | 30+ files | ✅ Keep for toasts |

---

## Alert Patterns Found

### 1. Native Browser Alerts (`alert()`)

**Files with native alerts:**

#### Employee Module

- `src/app/clothing/employees/team/[id]/page.tsx` (2 instances)
  - File size validation error
  - Upload failure error

- `src/app/clothing/employees/expenses/hooks/useExpenses.ts` (10+ instances)
  - Field validation errors
  - Receipt file not found
  - CSV import errors
  - Export validation

- `src/app/clothing/employees/attendance/hooks/useAttendance.ts` (12+ instances)
  - CSV validation errors
  - Import success/failure messages
  - Export validation

- `src/app/clothing/employees/cash-advance/hooks/useCashAdvance.ts` (8+ instances)
  - Deletion failures
  - Field validation errors
  - Approval/rejection failures
  - Import errors

#### Operations Module

- `src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx` (4 instances)
  - Simulation alerts for export/add/edit actions

- `src/modules/clothing/operations/dispatching/components/DispatchingComponent.tsx` (5 instances)
  - Simulation alerts for CRUD operations

- `src/components/expenses/csvUtils.ts` (1 instance)
  - Empty data export warning

### 2. Native Confirm Dialogs (`confirm()`)

**Files with confirm dialogs:**

- `src/app/clothing/employees/cash-advance/hooks/useCashAdvance.ts` (2 instances)
  - Delete confirmation (old and new versions)

- `src/app/clothing/employees/attendance/hooks/useAttendance.ts` (2 instances)
  - Delete attendance record confirmation
  - (Also in .old.ts version)

- `src/app/clothing/employees/expenses/hooks/useExpenses.ts` (1 instance)
  - Delete expense confirmation

- `src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts` (1 instance)
  - Clear/discard changes confirmation

### 3. SweetAlert2 (`Swal.fire()`)

**Already using SweetAlert2:**

#### Employee Module

- `src/app/clothing/employees/payroll/hooks/usePayroll.ts` (7 instances)
  - Delete confirmation with details
  - Success/error messages after actions
  - Approval confirmations

- `src/app/clothing/employees/attendance/hooks/useAttendance.ts` (7 instances)
  - Import success messages
  - Error handling
  - Status updates

- `src/app/clothing/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay.ts` (8 instances)
  - Record generation
  - Payment processing
  - Error handling

#### Operations Module

- `src/app/clothing/operations/customers/[id]/components/AdditionalCustomerInfoCard.tsx` (3 instances)
  - Field update confirmations
  - Delete confirmations

- `src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx` (1 instance)
  - Dispatch confirmation

- `src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx` (3 instances)
  - Backup/restore confirmations
  - Critical action confirmations

- `src/modules/clothing/operations/sorting-distribution/components/InfoSection.tsx` (1 instance)
  - Error display

### 4. Mantine Notifications (`notifications.show()`)

**Used for toast-style notifications:**

These are properly used for non-blocking notifications and should generally be kept. However, for **critical confirmations or errors**, SweetAlert2 should be preferred.

**Primary files:**

- All transaction operations (~40 instances)
- Customer management (~15 instances)
- Settings and backup operations (~20 instances)
- Attendance management (~10 instances)
- Expenses management (~6 instances)

---

## Migration Strategy

### Phase 1: Set Up Centralized System ✅

**Status:** COMPLETE

Created `/src/lib/alerts.ts` with:

- Type-safe wrapper functions
- Consistent styling
- Helper functions for common scenarios
- Migration helper functions

### Phase 2: Replace Native Alerts

**Priority:** HIGH

Replace all `alert()` and `confirm()` calls with SweetAlert2 equivalents.

**Order of migration:**

1. ✅ Employee Team page (2 alerts)
2. ⬜ Cash Advance module (8 alerts, 2 confirms)
3. ⬜ Attendance module (12 alerts, 2 confirms)
4. ⬜ Expenses module (10 alerts, 1 confirm)
5. ⬜ Operations modules (dispatch, dispatching)
6. ⬜ Utility files (csvUtils, receiptManager)

### Phase 3: Standardize Existing SweetAlert2 Usage

**Priority:** MEDIUM

Refactor existing `Swal.fire()` calls to use the centralized system for:

- Consistent styling
- Better error handling
- Easier maintenance

**Target files:**

- Payroll hooks
- Thirteenth Month Pay hooks
- Customer detail components
- Settings components

### Phase 4: Review Mantine Notifications

**Priority:** LOW

Review all `notifications.show()` usage to ensure:

- Used only for non-critical toasts
- Critical actions use SweetAlert2 confirmations
- Error messages that require user attention use SweetAlert2

---

## New Centralized System

### Location

All alert utilities are now in: **`/src/lib/alerts.ts`**

### Available Functions

#### Basic Alerts

```typescript
import {
  showAlert,
  showSuccess,
  showError,
  showWarning,
  showInfo,
} from '@/lib/alerts';

// Generic alert
await showAlert({ message: 'Operation completed!', type: 'success' });

// Shorthand functions
await showSuccess('Record saved successfully!');
await showError('Failed to save record');
await showWarning('This action cannot be undone');
await showInfo('No records found');
```

#### Confirmations

```typescript
import { showConfirm, showDeleteConfirm, showSaveConfirm } from '@/lib/alerts';

// Generic confirmation
const confirmed = await showConfirm({
  message: 'Are you sure you want to proceed?',
  type: 'question',
});

// Delete confirmation
const confirmDelete = await showDeleteConfirm('this record');
if (confirmDelete) {
  // Delete the record
}

// Save confirmation
const confirmSave = await showSaveConfirm();
if (confirmSave) {
  // Save changes
}
```

#### Toast Notifications

```typescript
import { showToast } from '@/lib/alerts';

// Quick non-blocking notification
showToast({ message: 'Saved successfully!', type: 'success' });
```

#### Loading States

```typescript
import { showLoading, closeAlert } from '@/lib/alerts';

// Show loading
showLoading('Processing your request...');

// Do async work
await someAsyncOperation();

// Close loading
closeAlert();
```

#### Drop-in Replacements

```typescript
import { alertReplace, confirmReplace } from '@/lib/alerts';

// Quick migration helpers
alertReplace('This is a message'); // replaces alert()

const result = await confirmReplace('Are you sure?'); // replaces confirm()
```

---

## Migration Examples

### Example 1: Simple Alert

**Before:**

```typescript
alert('Please select an image that is 2MB or smaller.');
```

**After:**

```typescript
import { showError } from '@/lib/alerts';

await showError(
  'Please select an image that is 2MB or smaller.',
  'File Size Error'
);
```

### Example 2: Confirmation Dialog

**Before:**

```typescript
if (confirm('Are you sure you want to delete this record?')) {
  deleteRecord();
}
```

**After:**

```typescript
import { showDeleteConfirm } from '@/lib/alerts';

const confirmed = await showDeleteConfirm('this record');
if (confirmed) {
  deleteRecord();
}
```

### Example 3: Standardizing Existing SweetAlert2

**Before:**

```typescript
const result = await Swal.fire({
  title: 'Confirm Delete',
  text: 'Are you sure you want to delete this payroll record?',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonText: 'Delete',
  cancelButtonText: 'Cancel',
});

if (result.isConfirmed) {
  // Delete logic
}
```

**After:**

```typescript
import { showDeleteConfirm } from '@/lib/alerts';

const confirmed = await showDeleteConfirm('this payroll record');
if (confirmed) {
  // Delete logic
}
```

### Example 4: Success After Save

**Before:**

```typescript
Swal.fire({
  icon: 'success',
  title: 'Success',
  text: 'Payroll record saved successfully',
});
```

**After:**

```typescript
import { showSuccess } from '@/lib/alerts';

await showSuccess('Payroll record saved successfully');
```

### Example 5: Error Handling

**Before:**

```typescript
alert('Failed to save record. Please try again.');
```

**After:**

```typescript
import { showError } from '@/lib/alerts';

await showError('Failed to save record. Please try again.');
```

---

## Files to Update

### High Priority (Native Alerts/Confirms)

#### Employee Module

- [ ] `src/app/clothing/employees/team/[id]/page.tsx` (2 alerts)
- [ ] `src/app/clothing/employees/cash-advance/hooks/useCashAdvance.ts` (8 alerts, 2 confirms)
- [ ] `src/app/clothing/employees/attendance/hooks/useAttendance.ts` (12 alerts, 2 confirms)
- [ ] `src/app/clothing/employees/expenses/hooks/useExpenses.ts` (10 alerts, 1 confirm)

#### Operations Module

- [ ] `src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx` (4 alerts)
- [ ] `src/modules/clothing/operations/dispatching/components/DispatchingComponent.tsx` (5 alerts)

#### Utilities

- [ ] `src/components/expenses/csvUtils.ts` (1 alert)
- [ ] `src/components/expenses/useReceiptManager.ts` (1 alert)

#### Transactions

- [ ] `src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts` (1 confirm)

### Medium Priority (Standardize SweetAlert2)

- [ ] `src/app/clothing/employees/payroll/hooks/usePayroll.ts`
- [ ] `src/app/clothing/employees/attendance/hooks/useAttendance.ts`
- [ ] `src/app/clothing/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay.ts`
- [ ] `src/app/clothing/operations/customers/[id]/components/AdditionalCustomerInfoCard.tsx`
- [ ] `src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx`
- [ ] `src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx`
- [ ] `src/modules/clothing/operations/sorting-distribution/components/InfoSection.tsx`

### Clean Up (Remove .old.ts files after verification)

- [ ] `src/app/clothing/employees/attendance/hooks/useAttendance.old.ts`
- [ ] `src/app/clothing/employees/payroll/hooks/usePayroll.old.ts`
- [ ] `src/app/clothing/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay.old.ts`
- [ ] `src/app/clothing/employees/cash-advance/hooks/useCashAdvance.old.ts`

---

## Testing Checklist

After migrating each file, verify:

### Functional Testing

- [ ] Alert displays correctly
- [ ] User can dismiss alert
- [ ] Confirmation returns correct boolean
- [ ] Actions execute properly after confirmation
- [ ] Error messages are clear and helpful
- [ ] Success messages appear at appropriate times

### UI/UX Testing

- [ ] Alerts are styled consistently
- [ ] Text is readable and properly formatted
- [ ] Buttons have correct labels
- [ ] Colors match the application theme (Mantine blue/red)
- [ ] Modals are properly centered
- [ ] Backdrop darkens appropriately

### Edge Cases

- [ ] Multiple rapid clicks don't create multiple alerts
- [ ] Loading states show and hide properly
- [ ] Alerts don't block critical functionality
- [ ] Mobile responsive (alerts fit on small screens)
- [ ] Keyboard navigation works (Esc to close, Enter to confirm)

### Accessibility

- [ ] Screen readers can read alert content
- [ ] Focus management is correct
- [ ] Color contrast meets WCAG standards
- [ ] Keyboard-only navigation works

---

## Benefits of Migration

### 1. **Consistency**

- All alerts look and behave the same
- Unified UX across the entire application
- Easier for users to learn and use

### 2. **Better UX**

- More visually appealing than native alerts
- Customizable styling
- Smooth animations
- Non-intrusive toasts available

### 3. **Developer Experience**

- Type-safe functions
- Better error handling
- Easier to test
- Centralized configuration
- Less code duplication

### 4. **Maintainability**

- Single source of truth
- Easy to update styling globally
- Better code organization
- Easier debugging

### 5. **Future-Proof**

- Easy to swap underlying library if needed
- Can add analytics/logging in one place
- Can implement custom themes
- Better control over behavior

---

## Migration Timeline

### Week 1: High Priority

- Replace all native alerts in employee modules
- Replace all native confirms

### Week 2: Medium Priority

- Standardize existing SweetAlert2 usage
- Update documentation

### Week 3: Testing & Polish

- Comprehensive testing
- Fix any issues
- Clean up old files
- Final review

---

## Notes

- **Mantine Notifications should still be used** for non-critical, informational toasts that don't require user action
- **SweetAlert2 should be used** for confirmations, errors, and any message requiring user attention
- Keep both systems for now, but prefer SweetAlert2 for alerts/confirms
- Consider adding custom CSS to better match Mantine's theme colors

---

## Additional Resources

- [SweetAlert2 Documentation](https://sweetalert2.github.io/)
- [Mantine Notifications](https://mantine.dev/others/notifications/)
- Migration utility: `/src/lib/alerts.ts`

---

**Last Updated:** November 2, 2025  
**Status:** Ready for migration

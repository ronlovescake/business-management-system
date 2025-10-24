# P2 Manual Testing Checklist

**Date:** \***\*\_\_\_\*\***  
**Tester:** \***\*\_\_\_\*\***  
**Environment:** \***\*\_\_\_\*\***

---

## Pre-Testing Setup

- [ ] Verify database migration applied

  ```bash
  npx prisma migrate status
  # Should show: Database schema is up to date!
  ```

- [ ] Verify API server is running

  ```bash
  npm run dev
  # Server should be at http://localhost:3000
  ```

- [ ] Have API testing tool ready (Postman/Insomnia/curl)

---

## Test Suite 1: Unique Constraints

### Test 1.1: Duplicate Employee Prevention ✓

**Objective:** Verify employeeId must be unique

**Steps:**

1. Create employee with ID "TEST-001"
   ```bash
   POST /api/employees
   {
     "employeeId": "TEST-001",
     "firstName": "First",
     "lastName": "Employee",
     "email": "first@test.com",
     "basicSalary": 5000
   }
   ```
2. Try to create another employee with same ID
   ```bash
   POST /api/employees
   {
     "employeeId": "TEST-001",
     "firstName": "Second",
     "lastName": "Employee",
     "email": "second@test.com",
     "basicSalary": 6000
   }
   ```

**Expected Result:**

- [x] First creation succeeds
- [x] Second creation fails with error code P2002
- [x] Error message mentions "unique constraint"

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 1.2: Duplicate Email Prevention ✓

**Objective:** Verify email must be unique (for non-deleted employees)

**Steps:**

1. Create employee with email "unique@test.com"
2. Try to create another employee with same email

**Expected Result:**

- [x] First creation succeeds
- [x] Second creation fails with unique constraint error

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 1.3: Duplicate Attendance Prevention ✓

**Objective:** Verify one attendance per employee per date

**Steps:**

1. Create attendance for TEST-001 on 2025-10-24
   ```bash
   POST /api/attendance
   {
     "employeeId": "TEST-001",
     "date": "2025-10-24",
     "status": "present",
     "totalHours": 8
   }
   ```
2. Try to create another attendance for same employee and date

**Expected Result:**

- [x] First creation succeeds
- [x] Second creation fails with unique constraint error

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 1.4: Duplicate Schedule Prevention ✓

**Objective:** Verify one schedule per employee per date per shift

**Steps:**

1. Create schedule for TEST-001 on 2025-10-24, shift "morning"
2. Try to create another schedule for same employee, date, and shift

**Expected Result:**

- [x] First creation succeeds
- [x] Second creation fails with unique constraint error

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

## Test Suite 2: Check Constraints

### Test 2.1: Negative Salary Prevention ✓

**Objective:** Verify salary must be non-negative

**Steps:**

1. Try to create employee with negative salary
   ```bash
   POST /api/employees
   {
     "employeeId": "TEST-NEG",
     "firstName": "Negative",
     "lastName": "Salary",
     "basicSalary": -5000
   }
   ```

**Expected Result:**

- [x] Creation fails
- [x] Error mentions check constraint violation
- [x] Constraint name: "employee_basic_salary_positive"

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 2.2: Invalid Hours Prevention (> 24) ✓

**Objective:** Verify hours must be between 0-24

**Steps:**

1. Try to create attendance with 30 hours
   ```bash
   POST /api/attendance
   {
     "employeeId": "TEST-001",
     "date": "2025-10-25",
     "status": "present",
     "totalHours": 30
   }
   ```

**Expected Result:**

- [x] Creation fails
- [x] Error mentions check constraint violation
- [x] Constraint name: "attendance_total_hours_valid"

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 2.3: Invalid Hours Prevention (< 0) ✓

**Objective:** Verify hours cannot be negative

**Steps:**

1. Try to create attendance with -5 hours

**Expected Result:**

- [x] Creation fails with check constraint error

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 2.4: Deductions > Gross Pay Prevention ✓

**Objective:** Verify total deductions cannot exceed gross pay

**Steps:**

1. Try to create payroll where deductions > gross pay
   ```bash
   POST /api/payroll
   {
     "employeeId": "TEST-001",
     ...
     "grossPay": 5000,
     "totalDeductions": 10000,
     "netPay": 0
   }
   ```

**Expected Result:**

- [x] Creation fails
- [x] Error mentions "payroll_deductions_valid"

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

## Test Suite 3: Soft Delete + Restore

### Test 3.1: Soft Delete Employee ✓

**Objective:** Verify soft delete works correctly

**Steps:**

1. Delete employee TEST-001
   ```bash
   DELETE /api/employees/TEST-001
   ```
2. Try to fetch deleted employee
   ```bash
   GET /api/employees/TEST-001
   ```

**Expected Result:**

- [x] Delete succeeds
- [x] GET returns 404 or empty result
- [x] Record still exists in database with deletedAt set

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 3.2: Reuse ID After Soft Delete ✓

**Objective:** Verify employeeId can be reused after soft delete

**Steps:**

1. Soft delete employee TEST-001 (if not already deleted)
2. Create new employee with same ID TEST-001

**Expected Result:**

- [x] New employee creation succeeds
- [x] New employee has different database ID
- [x] Old record still exists with deletedAt set

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 3.3: List Deleted Employees ✓

**Objective:** Verify restore API can list deleted records

**Steps:**

1. Call list deleted endpoint
   ```bash
   GET /api/employees/restore?limit=50
   ```

**Expected Result:**

- [x] Returns list of soft-deleted employees
- [x] All records have deletedAt field set
- [x] Response includes count and total

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 3.4: Restore Single Employee ✓

**Objective:** Verify single employee can be restored

**Steps:**

1. Get ID of deleted employee from list
2. Restore that employee
   ```bash
   POST /api/employees/restore
   {
     "id": "deleted-employee-uuid",
     "reason": "Testing restore"
   }
   ```

**Expected Result:**

- [x] Restore succeeds
- [x] Employee is now active (deletedAt = null)
- [x] Employee appears in normal GET /api/employees

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 3.5: Restore Conflict Detection ✓

**Objective:** Verify restore prevents conflicts

**Steps:**

1. Have two employees with same employeeId (one deleted, one active)
2. Try to restore the deleted one

**Expected Result:**

- [x] Restore fails
- [x] Error message: "Another active employee with ID ... already exists"

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 3.6: Bulk Restore ✓

**Objective:** Verify multiple employees can be restored at once

**Steps:**

1. Soft delete 3 employees
2. Bulk restore them
   ```bash
   PUT /api/employees/restore
   {
     "ids": ["id1", "id2", "id3"]
   }
   ```

**Expected Result:**

- [x] All 3 employees restored
- [x] Response shows success: 3, failed: 0
- [x] All employees now active

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

## Test Suite 4: Validation Integration

### Test 4.1: Application-Level Validation ✓

**Objective:** Verify Zod validation still works

**Steps:**

1. Try to create employee with invalid data (missing required field)

**Expected Result:**

- [x] Request fails with 400 Bad Request
- [x] Error message shows validation details
- [x] Does not reach database

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 4.2: Database Validation Backup ✓

**Objective:** Verify database catches what app validation misses

**Steps:**

1. Bypass app validation (direct DB query if possible)
2. Try to insert invalid data (e.g., negative salary)

**Expected Result:**

- [x] Database rejects the data
- [x] Check constraint error returned

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

## Test Suite 5: Performance

### Test 5.1: Index Performance ✓

**Objective:** Verify indexes improve query performance

**Steps:**

1. Create 100 employees
2. Query for specific employeeId
3. Check query plan

**Expected Result:**

- [x] Query uses index
- [x] Query time < 10ms
- [x] EXPLAIN shows index scan

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

### Test 5.2: Bulk Operations ✓

**Objective:** Verify batch limits work correctly

**Steps:**

1. Try to create 50 employees at once (below limit)
2. Try to create 15,000 employees at once (above 10k limit)

**Expected Result:**

- [x] 50 employees creation succeeds
- [x] 15,000 employees creation rejected
- [x] Error mentions batch size limit

**Actual Result:** \***\*\_\_\_\*\***  
**Status:** ☐ Pass ☐ Fail

---

## Database Verification Queries

### Check Constraint Count

```sql
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid IN (
    SELECT oid FROM pg_class
    WHERE relname IN ('employees', 'attendance', 'payrolls')
  );
```

**Expected:** 5  
**Actual:** \***\*\_\_\_\*\***

---

### Check Unique Index Count

```sql
SELECT COUNT(*) as unique_index_count
FROM pg_indexes
WHERE indexname LIKE '%_unique';
```

**Expected:** 5  
**Actual:** \***\*\_\_\_\*\***

---

### Check Performance Index Count

```sql
SELECT COUNT(*) as index_count
FROM pg_indexes
WHERE indexname IN (
  'attendance_employeeId_idx',
  'schedules_employeeId_idx',
  'payrolls_employeeId_idx',
  'leave_requests_employeeId_idx',
  'cash_advances_employeeId_idx'
);
```

**Expected:** 5  
**Actual:** \***\*\_\_\_\*\***

---

## Test Summary

**Total Tests:** 21  
**Passed:** ☐☐☐☐☐ ☐☐☐☐☐ ☐☐☐☐☐ ☐☐☐☐☐ ☐  
**Failed:** **\_**  
**Skipped:** **\_**

**Overall Status:** ☐ All Pass ☐ Some Failures ☐ Blocked

---

## Issues Found

### Issue 1

**Test:** \***\*\_\_\_\*\***  
**Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low  
**Description:** \***\*\_\_\_\*\***  
**Screenshot/Logs:** \***\*\_\_\_\*\***

---

### Issue 2

**Test:** \***\*\_\_\_\*\***  
**Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low  
**Description:** \***\*\_\_\_\*\***  
**Screenshot/Logs:** \***\*\_\_\_\*\***

---

## Sign-Off

**Tester Name:** \***\*\_\_\_\*\***  
**Date:** \***\*\_\_\_\*\***  
**Signature:** \***\*\_\_\_\*\***

**Recommendation:** ☐ Approve for Production ☐ Additional Testing Needed ☐ Issues Must Be Fixed

---

## Notes

_Add any additional observations, comments, or recommendations here:_

---

---

---

# 13th Month Pay - Duplicate Payment Prevention

## Issue Fixed

When generating payroll after marking 13th month pay as "Paid", the system was still including the 13th month amount in subsequent payroll generations, potentially causing duplicate payments.

### Problem Scenario

1. Generate payroll for Dec 1-15, 2025 → Includes ₱11,976.92 (13th month)
2. Mark 13th month pay as "Paid"
3. Generate payroll for Dec 16-31, 2025 → **Still included ₱11,976.92** ❌

This could result in paying the employee twice for their 13th month benefit.

## Solution Implemented

### File Modified

`src/app/api/payroll/generate/route.ts`

### Logic Added

Before generating payroll records, the system now:

1. **Fetches 13th month records** for the current year
2. **Checks payment status** for each employee
3. **Conditionally includes** 13th month amount:
   - ✅ **Include** if status is `calculated` or `approved` (not yet paid)
   - ❌ **Exclude** (set to ₱0) if status is `paid`

### Code Implementation

```typescript
// Fetch all 13th month records for this year
const thirteenthMonthRecords = await prisma.thirteenthMonthPayRecord.findMany({
  where: {
    year: payPeriodYear,
    employeeId: { in: employeeIds },
  },
  select: {
    employeeId: true,
    status: true,
    thirteenthMonthPay: true,
  },
});

// Create a map: employeeId -> { amount, isPaid }
const thirteenthMonthByEmployee = new Map(
  thirteenthMonthRecords
    .filter((record) => record.employeeId)
    .map((record) => [
      record.employeeId as string,
      {
        amount: Number(record.thirteenthMonthPay) || 0,
        isPaid: record.status === 'paid',
      },
    ])
);

// When generating payroll for each employee:
const thirteenthMonthData = thirteenthMonthByEmployee.get(employeeId);
const thirteenthMonth =
  thirteenthMonthData && !thirteenthMonthData.isPaid
    ? thirteenthMonthData.amount
    : 0;
```

## Expected Behavior After Fix

### Scenario: December 2025 Payroll

#### 1st Pay Period (Dec 1-15, 2025)

**Generate Payroll:**

```
Rain Joel Orong Subia
- Basic Salary: ₱7,500.00
- 13th Month: ₱11,976.92  ← INCLUDED (status: calculated/approved)
- Net Pay: ₱19,239.84
```

**Mark as Paid:**

- Mark payroll as paid
- 13th month record automatically marked as `status: paid`

#### 2nd Pay Period (Dec 16-31, 2025)

**Generate Payroll:**

```
Rain Joel Orong Subia
- Basic Salary: ₱7,500.00
- 13th Month: ₱0.00        ← EXCLUDED (status: paid)
- Net Pay: ₱7,262.92
```

✅ **No duplicate payment!**

## Benefits

### 1. **Prevents Double Payment**

Employees cannot receive 13th month pay twice in the same year

### 2. **Flexible Timing**

You can include 13th month in any December payroll:

- Last pay of November
- 1st pay of December
- 2nd pay of December

Once marked as paid, it won't appear again.

### 3. **Accurate Records**

Each year's 13th month is tracked independently:

- 2025 records stay locked once paid
- 2026 will start fresh with new calculations

### 4. **Manual Override Still Possible**

If needed, you can still manually edit a payroll record to add/remove 13th month pay

## Testing Recommendations

### Test Case 1: Normal Flow

1. Generate December 1st period payroll → Should include 13th month
2. Mark 13th month as paid
3. Generate December 2nd period payroll → Should show ₱0.00 for 13th month
4. Verify totals are correct

### Test Case 2: Mid-Year Payment

1. Generate November payroll → Should include 13th month (if approved)
2. Mark as paid
3. Generate December payrolls → Should show ₱0.00 for 13th month

### Test Case 3: Year Transition

1. Mark all 2025 13th month records as paid
2. Generate January 2026 payroll → Should show ₱0.00 (new year not calculated yet)
3. After payrolls accumulate, 2026 13th month records will be calculated
4. Those can be included in 2026 December payroll

## Database Schema

### Tables Involved

**`thirteenth_month_pay_records`**

- `recordId`: Employee ID + Year (e.g., "emp-0005-2025")
- `employeeId`: Reference to employee
- `year`: Year of the 13th month calculation
- `status`: `calculated` | `approved` | `paid`
- `thirteenthMonthPay`: Calculated amount

**`payrolls`**

- `employeeId`: Reference to employee
- `periodEnd`: Used to determine year
- `thirteenthMonth`: Amount included in this payroll (now dynamic based on paid status)

## Notes

- The fix only affects **new payroll generation**
- Existing payroll records are not modified
- Manual edits to payroll records are still respected
- The 13th month record status must be "paid" to trigger exclusion
- Year-based tracking ensures clean separation between years

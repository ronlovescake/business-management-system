# 13th Month Pay Database Persistence Complete

## Overview

Successfully implemented full database persistence for 13th month pay records with automatic recalculation from payroll data while preserving approved/paid status.

## Implementation Details

### 1. Database Schema (Prisma)

Created `ThirteenthMonthPayRecord` model in `prisma/schema.prisma`:

```prisma
model ThirteenthMonthPayRecord {
  id                  Int       @id @default(autoincrement())
  recordId            String    @unique
  employeeId          String
  employeeName        String
  year                Int
  status              String    @default("calculated")
  totalBasicSalary    Decimal   @db.Decimal(10, 2)
  totalLwop           Decimal   @db.Decimal(10, 2)
  totalAbsencesLates  Decimal   @db.Decimal(10, 2)
  netBasicSalary      Decimal   @db.Decimal(10, 2)
  monthsWorked        Int       @default(12)
  thirteenthMonthPay  Decimal   @db.Decimal(10, 2)
  notes               String?
  calculatedDate      DateTime?
  approvedDate        DateTime?
  paidDate            DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([year])
  @@index([status])
}
```

**Table created in database:** ✅ `thirteenth_month_pay_records`

### 2. Hook Modifications (`useThirteenthMonthPay.ts`)

#### A. Loading Records - Hybrid Approach

- **Auto-calculation:** Fresh calculation from current payroll data
- **Database fetch:** Load persisted approval status and locked values
- **Merge strategy:**
  - For `calculated` status: Use fresh payroll data, preserve status/dates
  - For `approved`/`paid` status: Lock all values, only update employee info (hireDate, tenureship)

```typescript
const loadAutomaticRecords = useCallback(async () => {
  // 1. Calculate fresh records from payroll
  const autoRecords = [...];

  // 2. Fetch persisted records from database
  const persistedResponse = await fetch('/api/thirteenth-month-pay');
  const persistedRecords = await persistedResponse.json();

  // 3. Merge: auto-calculated + persisted status
  setRecords((prevRecords) => {
    const persistedMap = new Map(persistedRecords);
    const mergedMap = new Map();

    // Add auto-calculated records
    autoRecords.forEach(record => mergedMap.set(record.id, record));

    // Overlay persisted records
    persistedMap.forEach((persisted, id) => {
      const isLocked = persisted.status === 'approved' || persisted.status === 'paid';
      if (isLocked) {
        // Lock all values for approved/paid
        mergedMap.set(id, { ...persisted, hireDate: auto.hireDate, tenureship: auto.tenureship });
      } else {
        // Use fresh calculation but preserve status/dates
        mergedMap.set(id, { ...auto, status: persisted.status, dates: persisted.dates });
      }
    });

    return Array.from(mergedMap.values());
  });
});
```

#### B. Persistence Functions - API Integration

**Approve Record:**

```typescript
const approveRecord = async (id: string) => {
  await fetch('/api/thirteenth-month-pay', {
    method: 'PATCH',
    body: JSON.stringify({
      recordId: id,
      status: 'approved',
      approvedDate: getCurrentDateISO(),
      // ... all field values
    }),
  });

  setRecords((prev) =>
    prev.map((r) =>
      r.id === id
        ? { ...r, status: 'approved', approvedDate: getCurrentDateISO() }
        : r
    )
  );
};
```

**Mark as Paid:**

```typescript
const markAsPaid = async (id: string) => {
  await fetch('/api/thirteenth-month-pay', {
    method: 'PATCH',
    body: JSON.stringify({
      recordId: id,
      status: 'paid',
      paidDate: getCurrentDateISO(),
      // ... all field values
    }),
  });

  setRecords((prev) =>
    prev.map((r) =>
      r.id === id ? { ...r, status: 'paid', paidDate: getCurrentDateISO() } : r
    )
  );
};
```

**Edit Record:**

```typescript
const editRecord = async (id: string, data: ThirteenthMonthPayFormData) => {
  const thirteenthMonthPay = calculate13thMonthPay(
    data.totalBasicSalary,
    data.totalLwop,
    data.totalAbsencesLates
  );

  await fetch('/api/thirteenth-month-pay', {
    method: 'PATCH',
    body: JSON.stringify({
      recordId: id,
      ...data,
      thirteenthMonthPay,
    }),
  });

  setRecords((prev) =>
    prev.map((r) => (r.id === id ? { ...r, ...data, thirteenthMonthPay } : r))
  );
};
```

**Delete Record:**

```typescript
const deleteRecord = async (id: string) => {
  await fetch('/api/thirteenth-month-pay', {
    method: 'DELETE',
    body: JSON.stringify({ recordId: id }),
  });

  setRecords((prev) => prev.filter((r) => r.id !== id));
};
```

### 3. Sync to Payroll (`deductions.ts`)

The `applyThirteenthMonthAdjustments` function syncs approved 13th month records to payroll:

```typescript
async function applyThirteenthMonthAdjustments(
  payrolls: Payroll[],
  year: number,
  month: number
): Promise<void> {
  const records = await prisma.thirteenthMonthPayRecord.findMany({
    where: { year, status: { in: ['approved', 'paid'] } },
  });

  const thirteenthMonthMap = new Map(
    records.map((r) => [r.employeeId, r.thirteenthMonthPay])
  );

  const updates: Promise<void>[] = [];

  for (const p of payrolls) {
    const amount = thirteenthMonthMap.get(p.employeeId) ?? 0;
    const target = selectThirteenthMonthTarget(p, month);

    if (target !== null && p[target] !== amount) {
      updates.push(
        prisma.payroll
          .update({
            where: { payrollId: p.payrollId },
            data: { [target]: amount },
          })
          .then()
      );
    }
  }

  await Promise.all(updates);
}
```

**Target Period Selection:**

- If `month === 5` (May) → `thirteenthMonthPayMay`
- Else if `month === 12` (December) → `thirteenthMonthPayDecember`
- Else → `null` (no sync)

## Workflow

### Auto-Recalculation Flow

1. **Page Load:**
   - Hook calculates fresh records from payroll data
   - Hook fetches persisted records from database
   - Merge: Fresh calculations + persisted status

2. **Status = `calculated`:**
   - Values auto-update with every payroll change
   - User can approve to lock values

3. **Status = `approved` or `paid`:**
   - Values locked (not recalculated)
   - Only employee info (hireDate, tenureship) updates
   - User can still manually edit if needed

### Approval Flow

1. User clicks "Approve" button
2. Hook calls `approveRecord(id)`
3. API persists to database with status = `approved`
4. Local state updates immediately
5. On next sync, payroll table updated with approved amount

### Sync to Payroll

1. `syncPayrollDeductions()` runs (triggered by payroll page/API)
2. Calls `applyThirteenthMonthAdjustments(payrolls, year, month)`
3. Fetches approved/paid records from database
4. Updates corresponding payroll period (May or December)
5. Skips months other than May/December

## Benefits

✅ **Persistent Approval Status:** Survives page refreshes  
✅ **Auto-Recalculation:** Calculated records update with payroll changes  
✅ **Locked Values:** Approved/paid records preserve exact amounts  
✅ **Sync to Payroll:** Approved amounts automatically flow to payroll table  
✅ **Audit Trail:** calculatedDate, approvedDate, paidDate tracked  
✅ **Manual Override:** Users can still edit approved records if needed

## Database Commands Run

```bash
# Generate Prisma client with new model
npx prisma generate

# Create table in database
npx prisma db push
```

**Result:** `thirteenth_month_pay_records` table created successfully ✅

## Status

✅ **Schema defined**  
✅ **Table created in database**  
✅ **Hook updated with persistence logic**  
✅ **Approve/Edit/Delete functions integrated with API**  
✅ **Merge logic for auto-calc + persisted records**  
✅ **Sync to payroll implemented**

**Ready for testing!** 🎉

# Data Integrity Enhancement Plan

## Current Status: ✅ Strong Foundation

You've implemented comprehensive P0-P2 safety measures. Here are additional enhancements to achieve **enterprise-grade data integrity**.

---

## TODO Tracker

### High Priority

- [x] Tighten TypeScript safety in `src/lib/safety/restore.ts`
- [x] Remove restore metadata fields that are not in `prisma/schema.prisma`
- [ ] Replace remaining API-layer `console` statements with the shared `logger`

### Medium Priority

- [ ] Introduce shared date range validation helpers (attendance, schedules, payroll, leave)
- [ ] Add numeric boundary constraints to the Zod validation schemas

---

## 🔴 P0: Critical Database Constraints (MUST HAVE)

### 1. Unique Constraints on Employee Records

**Issue:** Currently, `employeeId` doesn't have a unique constraint at the database level.

**Risk:** Multiple employees with the same ID could be created, causing data corruption.

**Solution:**

```prisma
// prisma/schema.prisma
model Employee {
  // ... existing fields

  @@unique([employeeId])  // ⚠️ ADD THIS
  @@unique([email], name: "employee_email_unique") // ⚠️ ADD THIS (when email is provided)
  @@unique([phone], name: "employee_phone_unique") // ⚠️ ADD THIS (when phone is provided)
}
```

**Migration:**

```sql
-- Check for duplicates first
SELECT "employeeId", COUNT(*)
FROM employees
WHERE "deletedAt" IS NULL
GROUP BY "employeeId"
HAVING COUNT(*) > 1;

-- Add unique constraint
CREATE UNIQUE INDEX "employee_employeeId_unique"
ON employees("employeeId")
WHERE "deletedAt" IS NULL;
```

---

### 2. Composite Unique Constraints for Time-Based Records

**Issue:** No database-level prevention of duplicate attendance/schedule entries for same employee on same date.

**Risk:** Duplicate time records cause calculation errors in payroll.

**Solution:**

```prisma
model Attendance {
  // ... existing fields

  @@unique([employeeId, date], name: "attendance_employee_date_unique")
}

model Schedule {
  // ... existing fields

  @@unique([employeeId, date, shiftType], name: "schedule_employee_date_shift_unique")
}

model Payroll {
  // ... existing fields

  @@unique([employeeId, periodStart, periodEnd], name: "payroll_employee_period_unique")
}
```

---

### 3. Foreign Key Constraints

**Issue:** Soft references (string-based `employeeId`) don't enforce referential integrity at database level.

**Current State:**

```prisma
model Attendance {
  employeeId String  // ⚠️ No FK constraint
}
```

**Recommended:**

```prisma
model Attendance {
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [employeeId])

  @@index([employeeId])
}

model Employee {
  attendanceRecords Attendance[]
  schedules         Schedule[]
  payrolls          Payroll[]
  leaveRequests     LeaveRequest[]
  // ... other relations
}
```

**Trade-off:** This requires cascade delete configuration and may impact soft delete behavior. Consider carefully.

---

## 🟡 P1: Application-Level Validation Enhancements

### 4. Date Range Validation

**Issue:** No validation ensuring date ranges are logical.

**Examples:**

- `periodStart` > `periodEnd` in payroll
- `timeIn` > `timeOut` in attendance (partially handled)
- `startDate` > `endDate` in leave requests

**Solution:** Create a date validation utility:

```typescript
// src/lib/validations/date-validation.ts
export function validateDateRange(
  start: string | Date,
  end: string | Date,
  fieldNames: { start: string; end: string } = {
    start: 'startDate',
    end: 'endDate',
  }
): { valid: boolean; error?: string } {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime())) {
    return { valid: false, error: `Invalid ${fieldNames.start}` };
  }

  if (isNaN(endDate.getTime())) {
    return { valid: false, error: `Invalid ${fieldNames.end}` };
  }

  if (startDate > endDate) {
    return {
      valid: false,
      error: `${fieldNames.start} cannot be after ${fieldNames.end}`,
    };
  }

  return { valid: true };
}
```

**Apply to schemas:**

```typescript
// Add to payroll validation
.refine(data => {
  const result = validateDateRange(data.periodStart, data.periodEnd);
  return result.valid;
}, {
  message: "Period start date must be before end date"
})
```

---

### 5. Business Logic Constraints

#### 5.1 Prevent Overlapping Leave Requests

**Issue:** Employee can have multiple approved leaves for same dates.

**Solution:**

```typescript
// src/lib/validations/leave-overlap-check.ts
export async function checkLeaveOverlap(
  employeeId: string,
  startDate: string,
  endDate: string,
  excludeId?: number
): Promise<{ hasOverlap: boolean; conflictingLeaves?: LeaveRequest[] }> {
  const overlapping = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      status: 'approved',
      deletedAt: null,
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        {
          AND: [
            { startDate: { lte: startDate } },
            { endDate: { gte: startDate } },
          ],
        },
        {
          AND: [{ startDate: { lte: endDate } }, { endDate: { gte: endDate } }],
        },
        {
          AND: [
            { startDate: { gte: startDate } },
            { endDate: { lte: endDate } },
          ],
        },
      ],
    },
  });

  return {
    hasOverlap: overlapping.length > 0,
    conflictingLeaves: overlapping,
  };
}
```

#### 5.2 Prevent Schedule Conflicts

**Issue:** Employee can be scheduled for multiple shifts at same time.

**Solution:** Similar overlap check for schedules.

#### 5.3 Payroll Period Lock

**Issue:** Paid payroll can still be modified.

**Solution:**

```typescript
// Add to payroll PATCH/PUT
if (existingPayroll.status === 'paid') {
  return NextResponse.json(
    {
      error: 'Cannot modify paid payroll',
      details:
        'Payroll records with status "paid" are locked and cannot be edited',
      suggestion: 'Create a payroll adjustment record instead',
    },
    { status: 403 }
  );
}
```

---

### 6. Numeric Boundary Validation

**Issue:** No upper bounds on numeric fields.

**Examples:**

- Negative hours (partially handled)
- Unrealistic salary amounts
- Break times exceeding shift duration

**Solution:** Add to validation schemas:

```typescript
// src/lib/validations/attendance.validation.ts
const attendanceSchema = z
  .object({
    totalHours: z
      .number()
      .min(0, 'Total hours cannot be negative')
      .max(24, 'Total hours cannot exceed 24 hours'), // ⚠️ ADD THIS

    breakMinutes: z.number().min(0).max(480), // 8 hours max break time
  })
  .refine(
    (data) => {
      // Break time can't exceed total hours
      const totalMinutes = data.totalHours * 60;
      return !data.breakMinutes || data.breakMinutes < totalMinutes;
    },
    {
      message: 'Break time cannot exceed total working hours',
    }
  );

// src/lib/validations/payroll.validation.ts
const payrollSchema = z
  .object({
    basicSalary: z
      .number()
      .min(0)
      .max(1000000, 'Salary exceeds reasonable limit'), // ⚠️ ADD THIS

    totalDeductions: z.number().min(0),
  })
  .refine(
    (data) => {
      // Deductions can't exceed gross pay
      return data.totalDeductions <= data.grossPay;
    },
    {
      message: 'Total deductions cannot exceed gross pay',
    }
  );
```

---

## 🟢 P2: Data Quality & Monitoring

### 7. Data Consistency Checks (Automated Reports)

Create scheduled jobs to detect data anomalies:

```typescript
// src/lib/data-integrity/consistency-checks.ts

export async function runConsistencyChecks() {
  const issues: string[] = [];

  // Check 1: Orphaned records
  const orphanedAttendance = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM attendance a
    WHERE a."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM employees e 
      WHERE e."employeeId" = a."employeeId" 
      AND e."deletedAt" IS NULL
    )
  `;

  // Check 2: Payroll calculation mismatches
  const payrollMismatches = await prisma.payroll.findMany({
    where: {
      deletedAt: null,
      // netPay != grossPay - totalDeductions
      NOT: {
        netPay: {
          equals: prisma.$queryRaw`"grossPay" - "totalDeductions"`,
        },
      },
    },
  });

  // Check 3: Attendance without schedules
  const attendanceWithoutSchedule = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM attendance a
    WHERE a."deletedAt" IS NULL
    AND a.status = 'present'
    AND NOT EXISTS (
      SELECT 1 FROM schedules s
      WHERE s."employeeId" = a."employeeId"
      AND s."date" = a."date"
      AND s."deletedAt" IS NULL
    )
  `;

  return {
    orphanedRecords: orphanedAttendance,
    payrollMismatches: payrollMismatches.length,
    attendanceWithoutSchedule,
    timestamp: new Date(),
  };
}
```

---

### 8. Audit Trail Enhancements

**Current:** Soft delete middleware captures snapshots.

**Enhancement:** Add detailed change tracking:

```typescript
// src/lib/audit/change-tracking.ts

export interface ChangeLog {
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId?: string;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  timestamp: Date;
}

export async function logChange(log: ChangeLog) {
  await prisma.auditLog.create({
    data: {
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      userId: log.userId,
      changes: JSON.stringify(log.changes),
      timestamp: log.timestamp,
    },
  });
}

// Usage in API routes
const before = await prisma.employee.findUnique({ where: { id } });
// ... make updates
const after = await prisma.employee.findUnique({ where: { id } });

await logChange({
  entityType: 'Employee',
  entityId: id,
  action: 'UPDATE',
  changes: diffObjects(before, after),
  timestamp: new Date(),
});
```

---

### 9. Rate Limiting on Critical Operations

**Issue:** No protection against rapid bulk operations.

**Solution:**

```typescript
// src/lib/safety/rate-limiting.ts
import { NextRequest, NextResponse } from 'next/server';

const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  request: NextRequest,
  operation: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute
): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const key = `${ip}:${operation}`;

  const now = Date.now();
  const record = rateLimits.get(key);

  if (record && record.resetAt > now) {
    if (record.count >= limit) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: `Too many ${operation} requests. Please wait before trying again.`,
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((record.resetAt - now) / 1000)),
          },
        }
      );
    }
    record.count++;
  } else {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
  }

  return null;
}

// Usage
const rateLimitCheck = checkRateLimit(request, 'employee_creation', 10, 60000);
if (rateLimitCheck) return rateLimitCheck;
```

---

### 10. Database Backup Verification

**Issue:** No automated verification that backups are working.

**Solution:** Add backup health check:

```typescript
// src/lib/safety/backup-verification.ts

export async function verifyBackupHealth() {
  // Check 1: Database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    return { healthy: false, error: 'Database connection failed' };
  }

  // Check 2: Record counts match expected ranges
  const counts = await prisma.$transaction([
    prisma.employee.count(),
    prisma.attendance.count(),
    prisma.payroll.count(),
  ]);

  // Check 3: Recent data exists
  const recentRecords = await prisma.employee.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
  });

  return {
    healthy: true,
    stats: {
      employees: counts[0],
      attendance: counts[1],
      payroll: counts[2],
      recentActivity: recentRecords,
    },
    timestamp: new Date(),
  };
}
```

---

## 📊 Implementation Priority

### Immediate (This Week)

1. ✅ **Unique constraint on `employeeId`** - Prevents data corruption
2. ✅ **Payroll period lock** - Prevents modification of paid records
3. ✅ **Date range validation** - Ensures logical date ranges

### Short-term (Next 2 Weeks)

4. ✅ **Composite unique constraints** (attendance, schedule, payroll)
5. ✅ **Numeric boundary validation** in schemas
6. ✅ **Leave overlap prevention**
7. ✅ **Rate limiting** on bulk operations

### Medium-term (Next Month)

8. ✅ **Foreign key constraints** (requires schema refactoring)
9. ✅ **Enhanced audit trail** with change tracking
10. ✅ **Automated consistency checks** (scheduled job)

### Long-term (Next Quarter)

11. ✅ **Backup verification** automation
12. ✅ **Data quality dashboard** for monitoring
13. ✅ **Anomaly detection** using ML (optional)

---

## 🛠️ Quick Wins (Can Implement Today)

### 1. Add Unique Constraint Check Before Creation

```typescript
// In employee POST API
const existing = await prisma.employee.findFirst({
  where: {
    OR: [
      { employeeId: validation.data.employeeId },
      { email: validation.data.email },
      { phone: validation.data.phone },
    ],
    deletedAt: null,
  },
});

if (existing) {
  const field =
    existing.employeeId === validation.data.employeeId
      ? 'employeeId'
      : existing.email === validation.data.email
        ? 'email'
        : 'phone';

  return NextResponse.json(
    {
      error: 'Duplicate entry',
      details: `An employee with this ${field} already exists`,
      field,
      existingEmployeeId: existing.employeeId,
    },
    { status: 409 }
  );
}
```

### 2. Add Payroll Lock Check

```typescript
// In payroll PUT/PATCH API
if (existingPayroll.status === 'paid') {
  return NextResponse.json(
    {
      error: 'Payroll locked',
      details: 'Cannot modify paid payroll records',
      payrollId: existingPayroll.id,
      status: existingPayroll.status,
    },
    { status: 403 }
  );
}
```

### 3. Add Date Range Validation

Already have the schemas, just add refinements!

---

## 📈 Monitoring Recommendations

### Key Metrics to Track

1. **Validation Failure Rate** - Track which validations fail most often
2. **Duplicate Prevention** - Count how many duplicates were prevented
3. **Employee Existence Checks** - Track 409 errors from missing employees
4. **Mass Deletion Attempts** - Monitor confirmation token usage
5. **Soft Delete Recovery** - Track how often deleted data is recovered

### Alerts to Configure

- ⚠️ More than 5 validation failures in 1 minute
- ⚠️ Any hard delete operation (should never happen)
- ⚠️ More than 100 records deleted in single operation
- ⚠️ Orphaned records detected (referential integrity breach)
- ⚠️ Payroll calculation mismatches

---

## 🎯 Success Criteria

You'll know you have **enterprise-grade data integrity** when:

- ✅ **Zero orphaned records** (all foreign keys valid)
- ✅ **Zero duplicate primary identifiers** (employeeId, email, phone)
- ✅ **100% validation coverage** (all input validated)
- ✅ **Complete audit trail** (all changes tracked)
- ✅ **Automated monitoring** (anomalies detected automatically)
- ✅ **Recovery tested** (backups verified regularly)
- ✅ **Rate limits enforced** (no abuse possible)
- ✅ **Business rules enforced** (no overlapping leaves, locked payrolls, etc.)

---

## 🚀 Next Steps

1. **Review this plan** with your team
2. **Prioritize** based on your risk tolerance
3. **Implement P0 items** first (database constraints)
4. **Test thoroughly** with existing data
5. **Monitor metrics** after deployment
6. **Iterate** based on real-world usage

Want me to implement any of these enhancements for you? Just let me know which ones!

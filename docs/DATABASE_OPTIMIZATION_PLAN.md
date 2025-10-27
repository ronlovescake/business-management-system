# Database Query Optimization Plan

**Created:** October 27, 2025  
**Priority:** P1 - High Priority  
**Estimated Time:** 6-10 hours  
**Status:** In Progress

---

## 🎯 Objective

Improve database query performance by:

1. Adding composite indexes for frequently queried column combinations
2. Optimizing API routes to use `select` for specific fields
3. Implementing query result caching for frequently accessed data
4. Monitoring and benchmarking query performance

---

## 📊 Current State Analysis

### ✅ What's Already Good

- **Single-column indexes exist** on most frequently queried fields:
  - `Employee`: employeeId, department, status, firstName+lastName, deletedAt
  - `Attendance`: employeeId, employeeName, date, status, department, deletedAt
  - `Payroll`: employeeId, employeeName, payPeriod, periodStart, status, deletedAt
  - `LeaveRequest`: employeeId, employeeName, leaveType, status, paymentStatus, startDate, appliedDate
  - `Transaction`: orderDate, customers, productCode, orderStatus, shipmentCode
  - `Product`: productCode, shipmentCode, shipmentStatus, payment, ageRange
  - `Customer`: customerName, phoneNumber, customerStatus
  - `Expense`: date, category, status, employeeName

- **Prisma prevents most N+1 queries** automatically
- **Soft-delete pattern** implemented (deletedAt field)
- **Audit logging** middleware active

### ⚠️ What Needs Improvement

1. **Missing composite indexes** for common query patterns
2. **Over-fetching data** - Many queries fetch all columns when only a few are needed
3. **No query result caching** for frequently accessed, rarely changing data
4. **No query performance monitoring**

---

## 🔍 Common Query Patterns Identified

### Pattern 1: Attendance Filtering (High Frequency)

```typescript
// Usage: Payroll generation, leave sync, reports
prisma.attendance.findMany({
  where: {
    deletedAt: null,
    status: { in: ['present', 'late'] },
    date: { gte: startDate, lte: endDate },
  },
});
```

**Impact:** Used in payroll generation (every 2 weeks), reports (daily)  
**Current indexes:** date, status, deletedAt (separate)  
**Proposed:** Composite index on `(status, date, deletedAt)`

### Pattern 2: Employee Lookup by ID (Very High Frequency)

```typescript
// Usage: Every employee-related operation
prisma.employee.findMany({
  where: {
    deletedAt: null,
    employeeId: { in: [...employeeIds] },
  },
});
```

**Impact:** Used in attendance, payroll, schedules, expenses, leave tracking  
**Current indexes:** employeeId, deletedAt (separate)  
**Proposed:** Composite index on `(employeeId, deletedAt)` or `(deletedAt, employeeId)`

### Pattern 3: Payroll by Period (High Frequency)

```typescript
// Usage: Payroll editing, LWOP sync, reports
prisma.payroll.findMany({
  where: {
    deletedAt: null,
    periodStart: startDate,
    periodEnd: endDate,
  },
});
```

**Impact:** Used in payroll operations (bi-weekly), LWOP sync (on-demand)  
**Current indexes:** periodStart, deletedAt (separate)  
**Proposed:** Composite index on `(periodStart, periodEnd, deletedAt)`

### Pattern 4: Leave Requests by Status (High Frequency)

```typescript
// Usage: Leave approval, payroll LWOP sync
prisma.leaveRequest.findMany({
  where: {
    status: 'approved',
    paymentStatus: 'unpaid',
  },
});
```

**Impact:** Used in LWOP sync, leave reports  
**Current indexes:** status, paymentStatus (separate)  
**Proposed:** Composite index on `(status, paymentStatus)`

### Pattern 5: Transactions by Customer (High Frequency)

```typescript
// Usage: Customer details, reports, invoice generation
prisma.transaction.findMany({
  where: {
    deletedAt: null,
    customers: customerName,
  },
});
```

**Impact:** Used in customer transactions view, invoice generation  
**Current indexes:** customers, deletedAt (separate)  
**Proposed:** Composite index on `(customers, deletedAt)`

### Pattern 6: Schedules by Employee and Date Range (High Frequency)

```typescript
// Usage: Attendance sync, schedule management
prisma.schedule.findMany({
  where: {
    deletedAt: null,
    employeeId: employeeId,
    date: { gte: startDate, lte: endDate },
  },
});
```

**Impact:** Used in attendance auto-recording, schedule views  
**Current indexes:** employeeId, date, deletedAt (separate)  
**Proposed:** Composite index on `(employeeId, date, deletedAt)`

### Pattern 7: Expenses by Status and Date (Medium Frequency)

```typescript
// Usage: Expense reports, approval workflow
prisma.expense.findMany({
  where: {
    status: 'pending',
    date: { gte: startDate, lte: endDate },
  },
});
```

**Impact:** Used in expense approval, reports  
**Current indexes:** status, date (separate)  
**Proposed:** Composite index on `(status, date)`

---

## 🚀 Implementation Plan

### Phase 1: Add Composite Indexes (2-3 hours)

#### Step 1.1: High-Impact Indexes

```prisma
// prisma/schema.prisma

model Attendance {
  // ... existing fields ...

  @@index([status, date, deletedAt]) // For payroll generation queries
  @@index([employeeId, date, deletedAt]) // For employee attendance lookups
}

model Employee {
  // ... existing fields ...

  @@index([deletedAt, employeeId]) // For active employee lookups
  @@index([status, deletedAt]) // For active employee filtering
}

model Payroll {
  // ... existing fields ...

  @@index([periodStart, periodEnd, deletedAt]) // For period-based queries
  @@index([employeeId, periodStart, deletedAt]) // For employee payroll history
}

model LeaveRequest {
  // ... existing fields ...

  @@index([status, paymentStatus]) // For LWOP sync queries
  @@index([employeeId, status]) // For employee leave history
}
```

#### Step 1.2: Medium-Impact Indexes

```prisma
model Transaction {
  // ... existing fields ...

  @@index([customers, deletedAt]) // For customer transactions
  @@index([orderStatus, deletedAt]) // For status-based filtering
}

model Schedule {
  // ... existing fields ...

  @@index([employeeId, date, deletedAt]) // For employee schedule lookups
  @@index([date, status, deletedAt]) // For daily schedule views
}

model Expense {
  // ... existing fields ...

  @@index([status, date]) // For expense approval queries
  @@index([employeeName, status]) // For employee expense filtering
}
```

#### Step 1.3: Migration and Testing

- [ ] Run migration: `npx prisma migrate dev --name add-composite-indexes`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Test all API routes still work correctly
- [ ] Monitor for any migration issues

### Phase 2: Optimize API Routes with `select` (2-3 hours)

#### Priority Routes for Optimization

**1. Attendance Route** (`src/app/api/attendance/route.ts`)

```typescript
// BEFORE: Fetches all 20+ columns
const attendance = await prisma.attendance.findMany({
  where: {
    /* filters */
  },
});

// AFTER: Fetch only needed columns
const attendance = await prisma.attendance.findMany({
  where: {
    /* filters */
  },
  select: {
    id: true,
    employeeId: true,
    employeeName: true,
    date: true,
    timeIn: true,
    timeOut: true,
    totalHours: true,
    status: true,
    // Exclude unnecessary fields like break times if not needed
  },
});
```

**2. Payroll Generation** (`src/app/api/payroll/generate/route.ts`)

```typescript
// Already optimized! ✅
const attendance = await prisma.attendance.findMany({
  where: {
    /* filters */
  },
  select: {
    employeeId: true,
    employeeName: true,
    totalHours: true,
  },
});

const employees = await prisma.employee.findMany({
  where: {
    /* filters */
  },
  select: {
    employeeId: true,
    name: true,
    basicSalary: true,
    currentSalary: true,
    allowance: true,
    // Only essential fields
  },
});
```

**3. Employee Routes** (`src/app/api/employees/route.ts`)

- Consider pagination for large employee lists
- Add select for list view (exclude profile photo, etc.)
- Keep full fetch for detail view

**4. Transaction Routes** (`src/app/api/transactions/route.ts`)

- Add select to exclude notes/large text fields in list view
- Use select for bulk CSV imports validation

### Phase 3: Implement Query Result Caching (2-3 hours)

#### Caching Strategy

**What to Cache:**

1. **Employee Directory** (rarely changes, frequently accessed)
2. **Price Tiers** (rarely changes, used in every transaction)
3. **Product Catalog** (changes occasionally, accessed frequently)
4. **Customer List** (changes occasionally, accessed frequently)

**Implementation Options:**

- **Option A:** Use React Query on client-side (already done! ✅)
- **Option B:** Add server-side Redis cache (for API-to-API calls)
- **Option C:** Use Prisma Accelerate (managed solution)

**For Now:** Focus on client-side caching with React Query (already implemented)

#### Future Server-Side Caching (Optional)

```typescript
// Example: Cache employee directory in memory
import NodeCache from 'node-cache';

const employeeCache = new NodeCache({ stdTTL: 600 }); // 10 minutes

export async function GET() {
  const cached = employeeCache.get<Employee[]>('employees');

  if (cached) {
    return NextResponse.json(cached);
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, status: 'active' },
  });

  employeeCache.set('employees', employees);
  return NextResponse.json(employees);
}
```

### Phase 4: Query Performance Monitoring (1-2 hours)

#### Enable Prisma Query Logging

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Log slow queries (> 100ms)
prisma.$on('query', (e: any) => {
  if (e.duration > 100) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: `${e.duration}ms`,
      params: e.params,
    });
  }
});

export { prisma };
```

#### Add Performance Benchmarks

```typescript
// tests/performance/database-queries.test.ts
describe('Database Query Performance', () => {
  it('should fetch attendance records within 100ms', async () => {
    const start = performance.now();

    await prisma.attendance.findMany({
      where: {
        deletedAt: null,
        date: { gte: '2025-01-01', lte: '2025-01-31' },
      },
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  // Add more benchmarks for critical queries
});
```

---

## 📈 Expected Improvements

### Query Performance

- **Attendance queries:** 40-60% faster with composite indexes
- **Employee lookups:** 30-50% faster with deletedAt composite
- **Payroll generation:** 50-70% faster with all optimizations
- **Leave sync:** 40-60% faster with composite indexes

### Database Load

- **Reduced scans:** Composite indexes reduce full table scans
- **Smaller result sets:** Using `select` reduces data transfer
- **Connection pool:** More efficient with faster queries

### API Response Times

- **List endpoints:** 30-50% faster
- **Reports:** 40-60% faster
- **Bulk operations:** 20-40% faster

---

## ⚠️ Risks and Mitigation

### Risk 1: Migration Downtime

**Mitigation:**

- Run migration during low-traffic hours
- Test on staging environment first
- Have rollback plan ready

### Risk 2: Index Size Increase

**Impact:** Composite indexes increase database size (estimated +5-10%)  
**Mitigation:**

- Monitor database size
- Remove unused indexes if necessary
- Indexes improve query speed, worth the trade-off

### Risk 3: Write Performance

**Impact:** More indexes = slower writes (INSERT/UPDATE/DELETE)  
**Mitigation:**

- This app is read-heavy, not write-heavy
- Indexes on deletedAt + other fields optimize soft-delete pattern
- Monitor write performance, but likely negligible impact

---

## ✅ Completion Checklist

### Phase 1: Composite Indexes

- [ ] Add composite indexes to Attendance model
- [ ] Add composite indexes to Employee model
- [ ] Add composite indexes to Payroll model
- [ ] Add composite indexes to LeaveRequest model
- [ ] Add composite indexes to Transaction model
- [ ] Add composite indexes to Schedule model
- [ ] Add composite indexes to Expense model
- [ ] Run migration
- [ ] Test all API routes
- [ ] Verify no errors in production

### Phase 2: Query Optimization

- [ ] Optimize Attendance route with select
- [ ] Optimize Employee routes with select
- [ ] Optimize Transaction routes with select
- [ ] Optimize Schedule routes with select
- [ ] Optimize Payroll routes (already optimized)
- [ ] Test all optimized routes
- [ ] Verify data completeness

### Phase 3: Caching

- [ ] Review React Query implementation (already done)
- [ ] Identify additional caching opportunities
- [ ] Document caching strategy
- [ ] (Optional) Implement server-side caching

### Phase 4: Monitoring

- [ ] Enable Prisma query logging
- [ ] Add slow query detection
- [ ] Create performance benchmarks
- [ ] Document monitoring approach
- [ ] Set up alerts for slow queries

---

## 📝 Notes

- Focus on **high-impact, low-risk** optimizations first
- **Composite indexes** are the biggest win for this application
- **React Query caching** is already implemented on client-side
- **Monitoring** is essential to identify future bottlenecks
- Consider **Prisma Accelerate** for global caching in the future

---

_Last Updated: October 27, 2025_  
_Status: Planning Complete - Ready for Implementation_

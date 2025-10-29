# Performance Monitoring Guide

This guide explains how to use the performance monitoring infrastructure in this application.

## 📊 Overview

The performance monitoring system tracks:

- **Web Vitals**: Core web vitals (CLS, FCP, LCP, TTFB, INP)
- **Custom Metrics**: Application-specific performance metrics
- **Component Renders**: React Profiler integration for component performance
- **API Response Times**: Automatic tracking of API endpoint performance
- **Memory Usage**: Browser memory tracking

## 🚀 Features

### 1. Web Vitals Tracking

Web Vitals are automatically tracked on all pages. The monitoring tracks:

- **CLS** (Cumulative Layout Shift): Visual stability
- **FCP** (First Contentful Paint): How quickly content appears
- **LCP** (Largest Contentful Paint): Main content load time
- **TTFB** (Time to First Byte): Server response time
- **INP** (Interaction to Next Paint): Responsiveness

**Performance Budgets:**

```typescript
{
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 }
}
```

### 2. Custom Metrics

Track custom performance metrics in your code:

```typescript
import { trackMetric } from '@/lib/performance/monitoring';

// Track a metric
trackMetric('user.login', 250, 'ms', {
  userId: '123',
  method: 'email',
});

// Track data processing
trackMetric('data.parse.csv', 1500, 'ms', {
  rows: 1000,
  columns: 15,
});
```

Metrics are buffered (max 100) and automatically logged if they exceed budget thresholds.

### 3. React Profiler

Track component render performance:

```tsx
import { Profiler } from 'react';
import { onRenderCallback } from '@/lib/performance/monitoring';

function MyPage() {
  return (
    <Profiler id="MyPage" onRender={onRenderCallback}>
      <MyExpensiveComponent />
    </Profiler>
  );
}
```

**What it tracks:**

- Render duration (actual vs baseline)
- Mount vs update renders
- Warns if render takes > 100ms

**Already profiled components:**

- `TransactionsPage` (ID: "TransactionsPage")
- `BiDashboard` (ID: "BiDashboard")

### 4. API Timing Middleware

Automatically track API endpoint performance:

```typescript
// In your API route: /api/customers/route.ts
import { withTiming } from '@/lib/performance/api-timing';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withTiming(async (request: NextRequest) => {
  const customers = await prisma.customer.findMany();
  return NextResponse.json(customers);
});
```

**Benefits:**

- Automatic timing of all API requests
- Logs warnings for slow endpoints (>1000ms)
- Adds `X-Response-Time` header to responses
- Tracks timing history (last 100 requests)

**Utility functions:**

```typescript
import {
  getRecentTimings,
  getAverageResponseTime,
  getSlowestEndpoints,
} from '@/lib/performance/api-timing';

// Get all recent timings
const timings = getRecentTimings();

// Get average for specific endpoint
const avgTime = getAverageResponseTime('/api/customers');

// Get slowest endpoints
const slow = getSlowestEndpoints(5); // Top 5 slowest
// Returns: [{ endpoint: '/api/x', avgDuration: 1234, count: 10 }, ...]
```

### 5. Memory Tracking

Monitor browser memory usage (Chrome only):

```typescript
import { trackMemory } from '@/lib/performance/monitoring';

const memory = trackMemory();
// Returns: { usedJSHeapSize: 50000000, totalJSHeapSize: 100000000, ... }
```

### 6. Performance Logging

Use the performance logger for structured logs:

```typescript
import { logger } from '@/lib/logger';

logger.performance('Data processing complete', {
  duration: 1234,
  rows: 5000,
  operation: 'csv-import',
});
// Logs: ⚡ Data processing complete { duration: 1234, rows: 5000, operation: 'csv-import' }
```

## 📈 Performance Budgets

The system enforces these performance budgets:

```typescript
{
  // Web Vitals
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 }, // ms
  LCP: { good: 2500, poor: 4000 }, // ms
  TTFB: { good: 800, poor: 1800 }, // ms
  INP: { good: 200, poor: 500 },   // ms

  // Application
  pageLoadTime: 3000,              // ms
  apiResponseTime: 1000,           // ms
  componentRenderTime: 100,        // ms
  databaseQueryTime: 500,          // ms
}
```

Violations are automatically logged as warnings.

## 🔍 Debugging Slow Performance

### Check Web Vitals

Open browser DevTools console and look for Web Vitals logs:

```
⚡ CLS: 0.05 (good)
⚡ FCP: 1200ms (good)
⚡ LCP: 2100ms (good)
⚡ TTFB: 650ms (good)
⚡ INP: 150ms (good)
```

### Check Component Renders

Look for Profiler warnings:

```
⚠️ Slow update detected in TransactionsPage: 145.23ms
  { actualDuration: 145.23, baseDuration: 120.45, ... }
```

### Check API Performance

```typescript
import { getSlowestEndpoints } from '@/lib/performance/api-timing';

// In a debug page or console
const slow = getSlowestEndpoints(10);
console.table(slow);
```

### Check Memory

```typescript
import { trackMemory } from '@/lib/performance/monitoring';

setInterval(() => {
  const mem = trackMemory();
  console.log('Memory:', mem);
}, 5000);
```

## 🎯 Best Practices

### 1. Use React Profiler for Heavy Components

Wrap components that:

- Render large lists/grids
- Perform heavy computations
- Have complex conditional logic
- Re-render frequently

```tsx
<Profiler id="HeavyDataGrid" onRender={onRenderCallback}>
  <DataGrid data={largeDataset} />
</Profiler>
```

### 2. Track Custom Metrics for Business Operations

```typescript
// CSV Import
trackMetric('csv.import', duration, 'ms', { rows: count });

// PDF Generation
trackMetric('pdf.generate', duration, 'ms', { type: 'invoice' });

// Data Validation
trackMetric('validation.run', duration, 'ms', { rules: 5 });
```

### 3. Use API Middleware for All Routes

Always wrap API handlers with `withTiming`:

```typescript
export const GET = withTiming(async (req) => {
  /* ... */
});
export const POST = withTiming(async (req) => {
  /* ... */
});
export const PUT = withTiming(async (req) => {
  /* ... */
});
export const DELETE = withTiming(async (req) => {
  /* ... */
});
```

### 4. Monitor Memory in Long-Running Operations

```typescript
async function processLargeDataset() {
  const startMem = trackMemory();

  // ... process data ...

  const endMem = trackMemory();
  logger.performance('Memory delta', {
    before: startMem.usedJSHeapSize,
    after: endMem.usedJSHeapSize,
    delta: endMem.usedJSHeapSize - startMem.usedJSHeapSize,
  });
}
```

## 📝 Examples

### Example 1: Track Database Query Performance

```typescript
import { startApiTimer } from '@/lib/performance/monitoring';

async function fetchCustomers() {
  const timer = startApiTimer('DB Query: customers');

  const customers = await prisma.customer.findMany({
    include: { transactions: true },
  });

  timer.end(); // Logs if > budget

  return customers;
}
```

### Example 2: Track User Action Performance

```typescript
import { trackMetric } from '@/lib/performance/monitoring';

async function handleFormSubmit(data: FormData) {
  const startTime = performance.now();

  // Process form
  await saveToDatabase(data);

  const duration = performance.now() - startTime;
  trackMetric('form.submit', duration, 'ms', {
    fields: Object.keys(data).length,
  });
}
```

### Example 3: Monitor Page Load Performance

```tsx
'use client';

import { useEffect } from 'react';
import { trackMetric } from '@/lib/performance/monitoring';

export function MyPage() {
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const loadTime = performance.now() - startTime;
      trackMetric('page.load', loadTime, 'ms', {
        page: 'customers',
      });
    };
  }, []);

  return <div>...</div>;
}
```

## 🔧 Configuration

All performance budgets and thresholds are defined in `src/lib/performance/monitoring.ts`:

```typescript
export const PERFORMANCE_BUDGET = {
  // Modify these to adjust your performance targets
  pageLoadTime: 3000,
  apiResponseTime: 1000,
  componentRenderTime: 100,
  databaseQueryTime: 500,
  // ...
};
```

## 📦 Dependencies

- `web-vitals`: Web Vitals tracking library
- React's built-in `Profiler` component
- Browser's `performance` API
- Chrome's `memory` API (optional)

## 🚨 Production Considerations

In production:

- Web Vitals are sent to your analytics platform
- Performance logs go to Sentry
- Memory tracking is disabled in non-Chrome browsers
- Metrics buffer is limited to 100 items to prevent memory leaks

## 📚 Additional Resources

- [Web Vitals](https://web.dev/vitals/)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Chrome Memory API](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory)

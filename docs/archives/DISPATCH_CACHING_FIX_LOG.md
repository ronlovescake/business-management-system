# Dispatch Page Caching Issue - Fix Attempts Log

## Problem Statement

**Issue**: The `/clothing/operations/dispatch` page in production build does not automatically reflect customer name changes from the database. It only shows updated data after rebuilding the entire application.

**Verified Facts**:

- Database has correct updated data (verified "thousand times")
- Development build works perfectly - shows updated data immediately
- Transactions page (`/clothing/operations/transactions`) works correctly in production
- Issue is ONLY with dispatch page in production build
- User receives ~10 new customers daily - cannot rebuild for each update
- Test case: Customer ID 1192, name should be "Sofiya Alexandria Mariano | Zenaida Medrano"

## Root Cause Analysis

The dispatch page uses React Query for client-side data fetching, which aggressively caches data in production builds. Despite multiple cache-busting attempts, the browser continues to serve old cached data.

---

## Attempted Fixes (Chronological Order)

### ❌ Fix #1: React Query Cache Invalidation (Failed)

**Date**: Session 1  
**Approach**: Added centralized query key management and cache invalidation on customer mutations

**Changes Made**:

- Created `src/lib/queryKeys.ts` with centralized query keys
- Added `customers.withShopee()` query key
- Modified `useCustomersData.ts` to invalidate both `customers.lists()` and `customers.withShopee()` on mutations
- Modified `useCustomerDetails.ts` to invalidate dispatch query key on customer updates

**Result**: Failed - Production still showed stale data

---

### ❌ Fix #2: Server-Side Data Fetching with Props (Failed)

**Date**: Session 1  
**Approach**: Fetch data server-side in page component and pass as props to client component

**Changes Made**:

- Modified `src/app/clothing/operations/dispatch/page.tsx` to fetch from database using Prisma
- Passed data as `serverCustomersData` prop to `DispatchComponent`
- Updated `useDispatchCustomerLookup` hook to accept optional server data

**Result**: Failed - Still showed stale data, then reverted to client-side fetching

---

### ❌ Fix #3: Aggressive HTTP Cache-Control Headers (Failed)

**Date**: Session 1-2  
**Approach**: Add maximum aggressive cache-busting headers to API route

**Changes Made**:

- Modified `/api/customers/with-shopee/route.ts` with:
  - `dynamic = 'force-dynamic'`
  - `fetchCache = 'force-no-store'`
  - `revalidate = 0`
  - Response headers: `'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0'`
  - CDN-specific headers: `'CDN-Cache-Control': 'no-store'`, `'Vercel-CDN-Cache-Control': 'no-store'`
  - Added timestamp to response to force uniqueness

**Result**: Failed - Production still cached data

---

### ❌ Fix #4: URL-Based Cache Busting (Failed)

**Date**: Session 2  
**Approach**: Add unique timestamp parameters to fetch URLs

**Changes Made**:

- Modified `useDispatchCustomerLookup.ts`:
  - Added `nocache=${timestamp}-${random}` to URL
  - Generated unique URL on every request
  - Set fetch options: `cache: 'no-store'`, `next: { revalidate: 0 }`

**Result**: Failed - React Query still returned cached data without calling fetch function

---

### ❌ Fix #5: BroadcastChannel Cross-Tab Communication (Failed)

**Date**: Session 2  
**Approach**: Use BroadcastChannel API to notify dispatch page of customer updates

**Changes Made**:

- Modified `useCustomersData.ts` to broadcast 'customer-updated' message after mutations
- Modified `useDispatchCustomerLookup.ts` to listen for broadcast and trigger refetch

**Result**: Failed - Messages sent but dispatch still showed stale data

---

### ❌ Fix #6: React Query Settings Adjustment (Failed)

**Date**: Session 2-3  
**Approach**: Set most aggressive React Query cache settings possible

**Changes Made**:

- Set `staleTime: 0` - data immediately stale
- Set `gcTime: 0` - no garbage collection delay
- Set `refetchOnMount: 'always'` - always refetch on mount
- Set `refetchOnWindowFocus: true`
- Set `refetchOnReconnect: true`
- Set `networkMode: 'always'`

**Result**: Failed - Console showed ZERO logs, proving fetch function never called

---

### ❌ Fix #7: Manual queryClient.removeQueries() (Failed)

**Date**: Session 3  
**Approach**: Manually clear React Query cache on component mount

**Changes Made**:

- Imported `useQueryClient` from React Query
- Added `useEffect` to call `queryClient.removeQueries()` on mount
- Attempted to force React Query to clear cache before fetching

**Result**: Failed - String replacement error, then approach abandoned due to ongoing issues

---

### ❌ Fix #8: Complete React Query Bypass with Manual Fetch (Failed)

**Date**: Session 3-4  
**Approach**: Remove React Query entirely, use manual fetch with useState

**Changes Made**:

- Removed all React Query usage from `useDispatchCustomerLookup.ts`
- Implemented manual fetch using `useState` and `useCallback`
- Added aggressive cache-busting: `timestamp-${random}-${perfNow}`
- Added extensive console logging (🔴 for fetch, 🟢 for success, 🔵 for hook operations)
- Set fetch headers: `'Cache-Control': 'no-cache, no-store, must-revalidate'`

**Result**: Failed - Got error `n.find is not a function` due to response format issue

---

### ❌ Fix #9: API Response Parsing Fix (Failed)

**Date**: Session 4  
**Approach**: Fix response parsing to extract data array from API response

**Changes Made**:

- Fixed parsing of `/api/customers/with-shopee` response
- Changed from `const data = await response.json()` to:
  ```typescript
  const jsonResponse = await response.json();
  const data = jsonResponse.data; // Extract array from { success: true, data: [...] }
  ```
- Added validation for response format

**Result**: Failed - Fix was correct but NO CONSOLE LOGS appeared, meaning browser was loading old cached JavaScript

---

### ⏳ Fix #10: Server-Side Rendering (SSR) with Database Fetch (CURRENT)

**Date**: Session 5 (Current)  
**Approach**: Fetch data directly from database on the server for EVERY page load, completely bypassing all client-side caching

**Changes Made**:

1. **Modified** `/src/app/clothing/operations/dispatch/page.tsx`:
   - Added direct Prisma database query in server component
   - Fetches customers with Shopee usernames on EVERY page load
   - Passes fresh data as `serverCustomersData` prop to client component
   - Added comprehensive server-side logging

2. **Modified** `/src/modules/clothing/operations/dispatch/hooks/useDispatchCustomerLookup.ts`:
   - Prioritizes server data when provided
   - Only falls back to client fetch if no server data
   - Added console logging to track data source
   - Logs sample customer (ID 1192) for verification

**Key Code**:

```typescript
// Server Component (page.tsx)
const customersWithShopee = await prisma.customer.findMany({
  where: { deletedAt: null },
  select: {
    id: true,
    customerName: true,
    businessName: true,
    facebook: true,
    additionalCustomerInfo: {
      where: { type: 'shopee_username', deletedAt: null },
      select: { value: true },
    },
  },
  orderBy: { id: 'asc' },
});

// Pass to component
<DispatchComponent serverCustomersData={serverCustomersData} />
```

**Expected Behavior**:

- Server fetches fresh data from database on EVERY navigation
- No client-side caching involved
- Should see 🟢 console logs showing server data usage
- Should display updated customer name: "Sofiya Alexandria Mariano | Zenaida Medrano"

**Status**: Build completed successfully. Waiting for server restart and browser test.

---

## Technical Details

### API Endpoints Used

- `/api/customers/with-shopee` - Custom endpoint for dispatch (problematic)
- `/api/customers` - Standard endpoint used by transactions page (works correctly)

### Key Files Modified

1. `src/app/clothing/operations/dispatch/page.tsx` - Server page component
2. `src/modules/clothing/operations/dispatch/hooks/useDispatchCustomerLookup.ts` - Data fetching hook
3. `src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx` - Client component
4. `src/app/api/customers/with-shopee/route.ts` - API route handler
5. `src/lib/queryKeys.ts` - Query key management
6. `src/modules/clothing/operations/customers/hooks/useCustomersData.ts` - Customer mutations
7. `src/app/clothing/operations/customers/[id]/hooks/useCustomerDetails.ts` - Customer detail hook

### Caching Layers Identified

1. **React Query Cache** - Client-side data cache
2. **Next.js Data Cache** - Build-time data cache
3. **Next.js Fetch Cache** - Fetch request cache
4. **Browser Cache** - HTTP cache for static assets and API responses
5. **CDN/Proxy Cache** - Network-level cache (if deployed)
6. **Service Worker Cache** - PWA cache (if enabled)

### Browser Cache Clearing Attempts

- Hard refresh (Ctrl+Shift+R)
- Clear browsing data (Ctrl+Shift+Delete)
- Suggested opening incognito window (not yet tested)

---

## Current Status

**Build**: ✅ Completed successfully at 22:35 PST  
**Server**: ⚠️ Port 3000 occupied, waiting for proper restart  
**Console Logs**: ❌ None visible (indicates old cached JavaScript still loading)  
**Data Update**: ❌ Still showing old customer name without pipe separator

## Next Steps to Test Current Fix

1. **Kill server process on port 3000**:

   ```bash
   sudo kill -9 7493  # (or whatever PID is on port 3000)
   npm start
   ```

2. **Clear browser cache completely**:
   - Press Ctrl+Shift+Delete
   - Select "Cached images and files"
   - Time range: "All time"
   - Click "Clear data"

3. **Test in incognito window** (to bypass all cache):
   - Open incognito/private browsing
   - Navigate to `http://localhost:3000/clothing/operations/dispatch`
   - Open console (F12)
   - Look for 🟢 logs showing server data usage

4. **Verify console output**:
   - Should see: `🟢 [DISPATCH] Using X customers from SERVER (database)`
   - Should see: `🟢 [DISPATCH] Customer 1192 from SERVER: { customerName: "Sofiya Alexandria Mariano | Zenaida Medrano", ... }`

## Key Learnings

1. **Production builds aggressively cache everything** - React Query, Next.js, and browsers all cache
2. **Browser cache is extremely persistent** - Hard refresh often insufficient
3. **Client-side cache-busting is unreliable** - URL parameters and headers often ignored
4. **Server-side rendering bypasses client caches** - Most reliable solution for always-fresh data
5. **Console logs prove code execution** - No logs = old code still running
6. **Incognito mode is best for testing** - Completely bypasses browser cache

## Comparison: Working vs Broken Pages

| Feature             | Transactions Page ✅ | Dispatch Page ❌ (before fix)   |
| ------------------- | -------------------- | ------------------------------- |
| Endpoint            | `/api/customers`     | `/api/customers/with-shopee`    |
| Data Fetching       | React Query          | React Query                     |
| Cache Strategy      | Standard staleTime   | Multiple cache-busting attempts |
| Works in Production | Yes                  | No                              |
| Shows Updated Data  | Yes                  | No (shows stale data)           |

## Notes for Future Reference

- **DO NOT rely on client-side cache-busting alone in production**
- **Server-side rendering (SSR) is most reliable for always-fresh data**
- **Test production builds in incognito mode** to verify cache behavior
- **Console logs are essential** for debugging production cache issues
- **Consider using same approach for all critical data** that must be fresh

---

**Last Updated**: November 13, 2025 22:50 PST  
**Current Attempt**: Fix #10 - Server-Side Rendering  
**Build Status**: Completed, awaiting server restart and browser test

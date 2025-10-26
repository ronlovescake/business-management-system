# Console.log Removal & Magic Numbers Extraction - Implementation Summary

**Date:** October 26, 2025  
**Task Duration:** Estimated 5-7 hours  
**Status:** ✅ Constants Created | 🔄 Console Migration In Progress

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [What Was Completed](#what-was-completed)
3. [Constants Documentation](#constants-documentation)
4. [Console.log Migration Guide](#consolelog-migration-guide)
5. [Magic Numbers Migration](#magic-numbers-migration)
6. [ESLint Configuration](#eslint-configuration)
7. [Next Steps](#next-steps)

---

## Overview

This document tracks the completion of two quick-win tasks from the TODO:

- **Task 8:** Remove console.log statements (2-4h)
- **Task 16:** Extract Magic Numbers to Constants (3-4h)

### Goals

1. **Replace all `console.*` calls** with the existing logger utility (`@/lib/logger`)
2. **Extract all magic numbers** to centralized, documented constants
3. **Prevent future violations** with ESLint rules
4. **Improve code maintainability** through better organization

---

## What Was Completed

### ✅ Phase 1: Constants Infrastructure (Complete)

Created 5 new constant files with comprehensive documentation:

1. **`src/constants/pagination.ts`** (47 lines)
   - Page sizes: DEFAULT, SMALL, MEDIUM, LARGE, MAX
   - Page size options for dropdowns
   - Initial page numbers (1-indexed and 0-indexed)

2. **`src/constants/timeouts.ts`** (107 lines)
   - API timeouts: SHORT, MEDIUM, LONG, EXTRA_LONG
   - Debounce delays for search and autosave
   - Toast notification durations
   - Retry delays with exponential backoff limits

3. **`src/constants/validation.ts`** (226 lines)
   - String length limits (SHORT, TEXT, MEDIUM, LONG, VERY_LONG)
   - Numeric limits (age, salary, price, quantity, discount)
   - File upload limits (images, CSV, documents)
   - Validation patterns (email, phone, URL, product code, etc.)
   - Password requirements (future use)

4. **`src/constants/batch-sizes.ts`** (144 lines)
   - Batch sizes for CSV imports (SMALL, MEDIUM, LARGE)
   - Database query limits
   - API request concurrency limits
   - Background job batch sizes
   - Search and filter limits

5. **`src/constants/limits.ts`** (220 lines)
   - Rate limiting thresholds (for P0 deployment)
   - Concurrent operation limits
   - Data retention policies
   - Cache TTL settings
   - Business rules (max orders, discounts, leave days)
   - System resource limits
   - UI/UX thresholds

6. **`src/constants/index.ts`** (13 lines)
   - Barrel export for easy imports
   - Example usage documented

**Total:** 757 lines of well-documented constants

### ✅ Phase 2: ESLint Configuration (Complete)

Updated `.eslintrc.json`:

```jsonc
{
  "rules": {
    // Strict no-console rule (was "warn", now "error")
    "no-console": "error",
  },
  "overrides": [
    {
      // Allow console in logger utility and scripts
      "files": ["src/lib/logger.ts", "scripts/**/*.js", "scripts/**/*.ts"],
      "rules": {
        "no-console": "off",
      },
    },
  ],
}
```

**Impact:** All new code will now require using `logger` instead of `console`

### 🔄 Phase 3: Console.log Migration (In Progress)

**Status:** 157 console statements found in `src/` directory

**Files requiring migration:**

| File/Module            | Console Statements | Priority | Estimated Time |
| ---------------------- | -----------------: | -------- | -------------- |
| `useTeam.ts`           |                40+ | P1       | 1h             |
| `useEmployeeDetail.ts` |                15+ | P1       | 30min          |
| `usePayroll.ts`        |                11+ | P1       | 30min          |
| `useAttendance.ts`     |                 9+ | P1       | 30min          |
| API routes (10 files)  |                 21 | P1       | 45min          |
| Other hooks (8 files)  |                40+ | P2       | 1h             |
| Services & Components  |                20+ | P2       | 30min          |

**Migration Pattern:**

```typescript
// ❌ Before
console.log('User action', data);
console.error('Error occurred:', error);
console.warn('Validation failed');

// ✅ After
import { logger } from '@/lib/logger';

logger.debug('User', 'User action', data);
logger.error('Error occurred:', error);
logger.warn('Validation failed');
```

### 🔄 Phase 4: Magic Numbers Migration (Pending)

**Common Patterns Found:**

| Pattern               | Occurrences (Est.) | Constant to Use       |
| --------------------- | -----------------: | --------------------- |
| `30000` (30s timeout) |                10+ | `DEFAULT_API_TIMEOUT` |
| `10000` (10s timeout) |                 5+ | `MEDIUM_TIMEOUT`      |
| `1000` (batch size)   |                 8+ | `DEFAULT_BATCH_SIZE`  |
| `100` (page size)     |                15+ | `DEFAULT_PAGE_SIZE`   |
| `50` (page size)      |                 5+ | `MEDIUM_PAGE_SIZE`    |
| `255` (max length)    |                20+ | `MAX_TEXT_LENGTH`     |
| `5000000` (5MB)       |                 3+ | `MAX_IMAGE_SIZE`      |

---

## Constants Documentation

### Usage Examples

```typescript
// Pagination
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/constants';

const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
// Dropdown: PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

// Timeouts
import { DEFAULT_API_TIMEOUT, LONG_TIMEOUT } from '@/constants';

const response = await fetch('/api/data', {
  signal: AbortSignal.timeout(DEFAULT_API_TIMEOUT),
});

// Validation
import { MAX_TEXT_LENGTH, EMAIL_PATTERN } from '@/constants';

const schema = z.object({
  name: z.string().max(MAX_TEXT_LENGTH),
  email: z.string().regex(EMAIL_PATTERN),
});

// Batch Processing
import { DEFAULT_BATCH_SIZE, MAX_CSV_ROWS } from '@/constants';

if (rows.length > MAX_CSV_ROWS) {
  throw new Error(`Cannot process more than ${MAX_CSV_ROWS} rows`);
}

for (let i = 0; i < rows.length; i += DEFAULT_BATCH_SIZE) {
  const batch = rows.slice(i, i + DEFAULT_BATCH_SIZE);
  await processBatch(batch);
}
```

### Why These Values?

Each constant includes JSDoc comments explaining:

- **Purpose:** What it's used for
- **Reasoning:** Why this specific value
- **Context:** Where it's applied

Example:

```typescript
/**
 * Default API request timeout
 * Used for: Standard API calls
 * Reasoning: Most API calls should complete within 30 seconds
 */
export const DEFAULT_API_TIMEOUT = 30000; // 30 seconds
```

---

## Console.log Migration Guide

### Step-by-Step Migration

#### 1. Identify Console Type

- **`console.log`** → `logger.log()` or `logger.debug()`
- **`console.error`** → `logger.error()`
- **`console.warn`** → `logger.warn()`
- **`console.info`** → `logger.info()`
- **Debug logs with emojis** → Remove or use `logger.debug()` with category

#### 2. Add Logger Import

```typescript
import { logger } from '@/lib/logger';
```

#### 3. Replace Console Calls

**General Logging:**

```typescript
// Before
console.log('Fetching data');

// After
logger.log('Fetching data');
```

**Debug Logging with Category:**

```typescript
// Before
console.log('🔵 [useTeam] handleSaveEmployee called');

// After
logger.debug('useTeam', 'handleSaveEmployee called');
```

**Error Logging:**

```typescript
// Before
console.error('Error saving employee:', error);

// After
logger.error('Error saving employee:', error);
```

**Warning Logging:**

```typescript
// Before
console.warn('Validation failed');

// After
logger.warn('Validation failed');
```

#### 4. Remove Unnecessary eslint-disable Comments

```typescript
// Before
/* eslint-disable no-console */
console.log('Debug info');

// After (no comment needed)
logger.debug('Module', 'Debug info');
```

### Priority Order

1. **API Routes** (P1) - User-facing, high traffic
2. **Critical Hooks** (P1) - useTeam, useEmployeeDetail, usePayroll, useAttendance
3. **Other Hooks** (P2) - useSchedules, useCashAdvance, etc.
4. **Services** (P2) - CustomerService, etc.
5. **Components** (P3) - Lower priority

---

## Magic Numbers Migration

### Common Patterns to Replace

#### Timeouts

```typescript
// ❌ Before
setTimeout(() => doSomething(), 30000);
fetch(url, { signal: AbortSignal.timeout(10000) });

// ✅ After
import { DEFAULT_API_TIMEOUT, MEDIUM_TIMEOUT } from '@/constants';

setTimeout(() => doSomething(), DEFAULT_API_TIMEOUT);
fetch(url, { signal: AbortSignal.timeout(MEDIUM_TIMEOUT) });
```

#### Pagination

```typescript
// ❌ Before
const [pageSize] = useState(100);
const limit = 50;

// ✅ After
import { DEFAULT_PAGE_SIZE, MEDIUM_PAGE_SIZE } from '@/constants';

const [pageSize] = useState(DEFAULT_PAGE_SIZE);
const limit = MEDIUM_PAGE_SIZE;
```

#### Validation

```typescript
// ❌ Before
if (name.length > 255) throw new Error('Too long');
if (fileSize > 5 * 1024 * 1024) throw new Error('Too large');

// ✅ After
import { MAX_TEXT_LENGTH, MAX_IMAGE_SIZE } from '@/constants';

if (name.length > MAX_TEXT_LENGTH) throw new Error('Too long');
if (fileSize > MAX_IMAGE_SIZE) throw new Error('Too large');
```

#### Batch Processing

```typescript
// ❌ Before
for (let i = 0; i < data.length; i += 1000) {
  const batch = data.slice(i, i + 1000);
  // process batch
}

// ✅ After
import { DEFAULT_BATCH_SIZE } from '@/constants';

for (let i = 0; i < data.length; i += DEFAULT_BATCH_SIZE) {
  const batch = data.slice(i, i + DEFAULT_BATCH_SIZE);
  // process batch
}
```

### Search Patterns

Use these patterns to find magic numbers:

```bash
# Find hardcoded timeouts
grep -rn "setTimeout\|setInterval" src/ --include="*.ts" --include="*.tsx"

# Find hardcoded batch sizes
grep -rn "slice(.*1000\|batch.*=.*1000" src/

# Find hardcoded pagination
grep -rn "pageSize.*=.*\d+\|limit.*=.*\d+" src/

# Find hardcoded validation limits
grep -rn "\.length >.*\d+\|fileSize.*>.*\d+" src/
```

---

## ESLint Configuration

### No-Console Rule

**Rule:** `"no-console": "error"`

**Exceptions:**

- `src/lib/logger.ts` - The logger utility itself
- `scripts/**/*.js` - Build and migration scripts
- `scripts/**/*.ts` - TypeScript scripts

### Testing the Rule

```bash
# Run ESLint to find violations
npm run lint

# Auto-fix some violations (won't fix console statements)
npm run lint -- --fix
```

### Current Violations

After enabling the strict rule, you'll see ~157 ESLint errors. This is expected and is our TODO list for Phase 3.

---

## Next Steps

### Immediate (Priority 1 - 3-4 hours)

1. **Migrate API Routes** (45min)
   - Update 10 API route files
   - Replace all `console.error` with `logger.error`

2. **Migrate Critical Hooks** (2h)
   - `useTeam.ts` (40+ console statements) - 1h
   - `useEmployeeDetail.ts` (15+ statements) - 30min
   - `usePayroll.ts` (11+ statements) - 30min

3. **Test Logger Functionality** (15min)
   - Verify logs appear in development
   - Verify logs are stripped in production build

### Medium Priority (2-3 hours)

4. **Migrate Remaining Hooks** (1.5h)
   - useAttendance, useSchedules, useCashAdvance, etc.

5. **Migrate Services and Components** (1h)
   - CustomerService validation warnings
   - Component error handlers

### Lower Priority (1-2 hours)

6. **Magic Numbers Migration** (2h)
   - Search for common patterns
   - Replace with constants
   - Test functionality

7. **Documentation Updates** (30min)
   - Update README with constants guide
   - Add migration examples to docs

### Validation

- [ ] Run `npm run lint` - should show 0 errors after migration
- [ ] Run tests - all tests should pass
- [ ] Build for production - `npm run build`
- [ ] Verify logger behavior in dev vs prod

---

## Impact Assessment

### Benefits

✅ **Code Quality:**

- Centralized, documented constants
- Consistent logging patterns
- Better maintainability

✅ **Developer Experience:**

- Clear, self-documenting code
- Easy to find and update thresholds
- Type-safe constant imports

✅ **Production Safety:**

- Debug logs automatically stripped
- Errors still logged for monitoring
- ESLint prevents future violations

✅ **Performance:**

- No performance impact (constants are inline)
- Logger has zero overhead in production

### Risks

⚠️ **Low Risk:**

- Large number of files to update (157 console statements)
- Potential for merge conflicts in active branches
- Need to coordinate with team on constant changes

### Mitigation

- Break work into small, focused commits
- Test each module after migration
- Use find-and-replace patterns for speed
- Review changes carefully

---

## Statistics

### Phase 1: Constants (Complete)

- **Files Created:** 6
- **Lines Added:** ~770
- **Constants Defined:** ~100+
- **Time Spent:** 1 hour

### Phase 2: ESLint (Complete)

- **Files Modified:** 1 (`.eslintrc.json`)
- **Rules Added:** 1
- **Overrides Added:** 1
- **Time Spent:** 10 minutes

### Phase 3: Console Migration (Pending)

- **Files to Update:** ~40
- **Statements to Replace:** 157
- **Estimated Time:** 3-4 hours

### Phase 4: Magic Numbers (Pending)

- **Patterns to Replace:** ~100+
- **Estimated Time:** 2-3 hours

### Total Progress

- **Completed:** 2/4 phases (50%)
- **Time Spent:** 1h 10min
- **Time Remaining:** 5-7 hours
- **Overall Status:** 🟢 On Track

---

## Commit Strategy

### Completed Commits

1. ✅ **"feat(constants): add centralized constants for pagination, timeouts, validation, batch-sizes, and limits"**
   - All 6 constant files
   - Comprehensive documentation
   - Barrel export

2. ✅ **"chore(eslint): enforce no-console rule with logger exceptions"**
   - Updated `.eslintrc.json`
   - Added overrides for logger.ts and scripts

### Planned Commits

3. **"refactor(api): replace console.error with logger in API routes"**
   - 10 API route files
   - Atomic, focused change

4. **"refactor(hooks): replace console statements with logger in useTeam"**
   - Single hook, large impact

5. **"refactor(hooks): replace console statements with logger in critical hooks"**
   - useEmployeeDetail, usePayroll, useAttendance

6. **"refactor: replace console statements with logger in remaining files"**
   - All other hooks, services, components

7. **"refactor: extract magic numbers to centralized constants"**
   - Timeouts, pagination, batch sizes, validation limits

---

## Resources

### Documentation

- [Logger Utility](/src/lib/logger.ts)
- [Constants Index](/src/constants/index.ts)
- [ESLint Configuration](/.eslintrc.json)

### Related TODOs

- ✅ Task 4: Fix Prisma Instances (Complete)
- ✅ Task 5: Input Sanitization (Complete)
- 🔄 **Task 8: Remove console.log (In Progress)**
- 🔄 **Task 16: Extract Magic Numbers (In Progress)**
- ⏳ Task 6: Sentry Integration (Next)
- ⏳ Task 7: Centralized API Client (Next)

---

_Last Updated: October 26, 2025_  
_Status: Phase 1-2 Complete, Phase 3-4 In Progress_

# Date, Time & Timezone Rules

> Canonical reference for all date/time formatting and timezone handling in the Business Management System.
> Every developer MUST follow these rules. Do **not** create inline formatters — use the centralized utilities listed below.

---

## 1. Timezone Policy

| Rule | Value |
|------|-------|
| **Application timezone** | `Asia/Manila` (PHT, UTC+8) |
| **Locale** | `en-US` |
| **Database storage** | UTC (`timestamptz` columns — PostgreSQL stores in UTC, converts on read) |
| **ISO date strings** | Always derive from Manila-aware formatters, **never** from `new Date().toISOString().slice(0,10)` |

### Why This Matters

The server runs in UTC (Docker default). Between **00:00–07:59 Manila time**, `new Date().toISOString()` returns the **previous UTC date**. If you use `.toISOString().slice(0,10)` for business dates (paid date, hire date, posting date), the app defaults to **yesterday** during those hours.

### Golden Rules

1. **Never use manual `+8h` offset hacks** — `new Date(now.getTime() + 8 * 60 * 60 * 1000)` then `.toISOString()` creates a double-offset bug (browsers add +8h again when parsing the `Z` suffix).
2. **Always pass `timeZone: 'Asia/Manila'`** in every `Intl.DateTimeFormat` and `toLocaleDateString`/`toLocaleTimeString` call.
3. **Always use `dayjs().tz()`** (not bare `dayjs()`) when formatting dates with dayjs — the timezone plugin must be active.
4. **Never use bare `.toLocaleDateString()` or `.toLocaleTimeString()`** without explicit options — output varies by environment.

---

## 2. Standard Display Format

```
April 01, 2026 · 12:00 AM
```

| Part | Format | Notes |
|------|--------|-------|
| **Date** | `April 01, 2026` | Full month name, zero-padded day, 4-digit year |
| **Separator** | ` · ` | Middle dot (U+00B7), with spaces on both sides — not a period |
| **Time** | `12:00 AM` | Zero-padded 12-hour clock, minutes, AM/PM |
| **Date-only** | `April 01, 2026` | When no time component is needed |
| **Time-only** | `12:00 AM` | When no date component is needed |

### Intl.DateTimeFormat Options

```ts
// Date part
const dateOptions: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Manila',
};

// Time part
const timeOptions: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Manila',
};

// Combined — format separately and join with " · "
// Intl.DateTimeFormat does not support custom separators, so:
const datePart = new Intl.DateTimeFormat('en-US', dateOptions).format(date);
const timePart = new Intl.DateTimeFormat('en-US', timeOptions).format(date);
const combined = `${datePart} · ${timePart}`;
// → "April 01, 2026 · 12:00 AM"
```

### dayjs Format Strings

```ts
// Date-only
'MMMM DD, YYYY'              // → "April 01, 2026"

// Date + time
'MMMM DD, YYYY [·] hh:mm A'  // → "April 01, 2026 · 12:00 AM"

// Time-only
'hh:mm A'                     // → "12:00 AM"
```

> The `[·]` syntax escapes the middle dot so dayjs treats it as a literal character.

---

## 3. Centralized Formatter Modules

All new code **MUST** import from one of these modules. Do **not** define inline `Intl.DateTimeFormat` or `toLocaleDateString` calls.

### `src/utils/dateFormatters.ts` — Primary Intl-Based Formatters

The main entry point for all Intl-based date/time formatting.

| Export | Returns | Example |
|--------|---------|---------|
| `dateFormatter.format(date)` | Date string | `"April 01, 2026"` |
| `timeFormatter.format(date)` | Time string | `"12:00 AM"` |
| `dateTimeFormatter.format(date)` | Date + time | `"April 01, 2026 · 12:00 AM"` |
| `formatDateTimeFull(date)` | Date + time (accepts `string \| Date`) | `"April 01, 2026 · 12:00 AM"` |
| `formatDateOnly(date)` | Date only (accepts `string \| Date`) | `"April 01, 2026"` |
| `formatTimeOnly(date)` | Time only (accepts `string \| Date`) | `"12:00 AM"` |
| `formatDateParts(isoDate)` | `{ date, time }` object | `{ date: "April 01, 2026", time: "12:00 AM" }` |
| `dateFormatterShort` | Alias → `dateFormatter` | Backward compat |
| `timeFormatterShort` | Alias → `timeFormatter` | Backward compat |
| `DATE_TIME_SEPARATOR` | `" · "` | Middle dot constant |

```ts
import { formatDateTimeFull, formatDateOnly } from '@/utils/dateFormatters';

const display = formatDateTimeFull(row.createdAt);  // "April 01, 2026 · 12:00 AM"
const dateOnly = formatDateOnly(row.paidDate);      // "April 01, 2026"
```

### `src/utils/date.ts` — dayjs-Based Formatters

For dayjs-specific operations (relative time, date math, parsing, timezone-aware formatting).

| Export | Returns | Example |
|--------|---------|---------|
| `formatDisplayDate(value, format?)` | Formatted date string | `"April 01, 2026"` |
| `formatDisplayDateTime(value)` | Date + time | `"April 01, 2026 · 12:00 AM"` |
| `getCurrentDateISO()` | Manila-aware ISO date | `"2026-04-01"` |
| `toISODate(value)` | ISO date from any input | `"2026-04-01"` |
| `toDate(value)` | Native `Date` in PHT | `Date` object |
| `timeAgo(value)` | Relative time | `"3 hours ago"` |
| `formatDate(value, pattern)` | Custom dayjs pattern | Any dayjs pattern |
| `DATE_DISPLAY_FORMAT` | `'MMMM DD, YYYY'` | Constant |
| `DATETIME_DISPLAY_FORMAT` | `'MMMM DD, YYYY [·] hh:mm A'` | Constant |
| `TIME_DISPLAY_FORMAT` | `'hh:mm A'` | Constant |
| `DATE_STORAGE_FORMAT` | `'YYYY-MM-DD'` | Constant |

```ts
import { formatDisplayDate, getCurrentDateISO, timeAgo } from '@/utils/date';

const display = formatDisplayDate(row.createdAt);   // "April 01, 2026"
const today = getCurrentDateISO();                   // "2026-04-01"
const relative = timeAgo(row.updatedAt);             // "3 hours ago"
```

### `src/services/FormatterService.ts` — Static Class Methods

Used in modules that already depend on `FormatterService` for currency/number formatting.

| Method | Returns | Example |
|--------|---------|---------|
| `FormatterService.formatDate(date)` | Date string | `"April 01, 2026"` |
| `FormatterService.formatDateShort(date)` | Date string (same) | `"April 01, 2026"` |
| `FormatterService.formatTime(time)` | Time string | `"12:00 AM"` |
| `FormatterService.formatDateTime(datetime)` | Date + time | `"April 01, 2026 · 12:00 AM"` |
| `FormatterService.formatDateISO(date)` | ISO date | `"2026-04-01"` |

### `src/lib/formatters.ts` — Generic Intl Wrapper

Low-level wrapper used by modules that need custom `Intl.DateTimeFormatOptions`. Exports `STANDARD_DATE_OPTIONS` and `STANDARD_TIME_OPTIONS` constants matching the standard format.

```ts
import { formatDateTime, STANDARD_DATE_OPTIONS } from '@/lib/formatters';

// Use the standard options
const display = formatDateTime(date, STANDARD_DATE_OPTIONS);

// Or pass custom options (still defaults to Asia/Manila timezone)
const custom = formatDateTime(date, { month: 'long', year: 'numeric' });
```

### `src/lib/transactions/constants.ts` — Transaction-Specific

| Export | Returns | Example |
|--------|---------|---------|
| `MANILA_TIME_FORMATTER.format(date)` | Date + time | `"April 01, 2026 · 12:00 AM"` |
| `MANILA_DATE_FORMATTER.format(date)` | Date only | `"April 01, 2026"` |

### `src/lib/payroll/formatters.ts` — Payroll-Specific

| Export | Returns | Example |
|--------|---------|---------|
| `formatPayrollDate(dateString)` | Date string | `"April 01, 2026"` |

### `src/lib/accounting/formatters.ts` — Accounting-Specific

| Export | Returns | Example |
|--------|---------|---------|
| `formatLongDateUS(date)` | Date string | `"April 01, 2026"` |

---

## 4. Which Formatter Should I Use?

```
Is it a React component or hook?
├── Yes → Do you already import from FormatterService?
│   ├── Yes → Use FormatterService.formatDate() / .formatDateTime()
│   └── No  → Use formatDateOnly() / formatDateTimeFull() from @/utils/dateFormatters
│
├── Do you need date math, relative time, or dayjs parsing?
│   └── Yes → Use formatDisplayDate() / timeAgo() from @/utils/date
│
├── Is it an API route or server action?
│   └── Yes → Use formatDateOnly() from @/utils/dateFormatters
│         or  formatDateTime() from @/lib/formatters with STANDARD_DATE_OPTIONS
│
└── Is it a PDF generation route?
    └── Yes → Use the Intl options directly with timeZone: 'Asia/Manila'
          (API routes can't always import client utilities)
```

**General guidance:** Prefer `@/utils/dateFormatters` for new code. It has the simplest API and is tree-shakable.

---

## 5. Getting Today's Date (Manila-Aware)

### Server-Side (API Routes, Server Actions)

```ts
// ✅ CORRECT — Manila-aware YYYY-MM-DD
import { getCurrentDateISO } from '@/utils/date';
const today = getCurrentDateISO();

// ✅ CORRECT — Pure Intl (no dayjs dependency)
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
}).format(new Date());
// → "2026-04-01" (en-CA locale produces YYYY-MM-DD)

// ❌ WRONG — Returns UTC date, off by 1 day between midnight and 8 AM PHT
const today = new Date().toISOString().slice(0, 10);
```

### Client-Side (Components, Hooks)

```ts
// ✅ CORRECT
import { getCurrentDateISO } from '@/utils/date';
const today = getCurrentDateISO();

// ❌ WRONG — Same UTC bug applies
const today = new Date().toISOString().slice(0, 10);
```

---

## 6. Exempt Formats (Do NOT Standardize)

These intentionally deviate from the standard format for legitimate reasons:

| Context | Format | Reason |
|---------|--------|--------|
| Calendar month headers | `"October 2025"` | Navigation — `month:'long', year:'numeric'` |
| Chart monthly/quarterly labels | `"Oct 2025"` | Axis space — `'MMM YYYY'` |
| Chart x-axis month ticks | `"Jan"`, `"Feb"` | Axis space — `month:'short'` only |
| Leave tracker date ranges | `"October 05 – 12, 2025"` | Compact range display |
| Relative time | `"3 hours ago"` | `dayjs.fromNow()` — not a date format |
| ISO date keys | `"2026-04-01"` | Storage/automation — not for display |
| Backup folder timestamps | `en-CA` YYYY-MM-DD format | Filesystem naming — not for display |
| CSV filename timestamps | `"2026-04-01"` in filename | Cosmetic only |

---

## 7. Common Anti-Patterns

### ❌ Manual UTC+8 Offset

```ts
// NEVER DO THIS — creates double-offset bug
const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
const timestamp = manila.toISOString(); // "Z" suffix lies — this is PHT, not UTC
```

### ❌ Bare toLocaleDateString

```ts
// NEVER DO THIS — output depends on browser/server locale
const display = date.toLocaleDateString();
// Could be "4/1/2026", "01/04/2026", "2026-04-01", etc.
```

### ❌ month: 'short'

```ts
// AVOID — produces "Apr 01, 2026" instead of "April 01, 2026"
date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
```

### ❌ day: 'numeric' (No Zero-Padding)

```ts
// AVOID — produces "April 1, 2026" instead of "April 01, 2026"
date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
```

### ❌ Missing timeZone

```ts
// AVOID — works in PHT browsers but breaks on UTC servers or non-PHT users
date.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
// Missing: timeZone: 'Asia/Manila'
```

### ❌ Inline Intl.DateTimeFormat

```ts
// AVOID — duplicates what dateFormatters.ts already provides
const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'long', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila',
});
// Instead: import { dateFormatter } from '@/utils/dateFormatters';
```

### ❌ dayjs Without Timezone

```ts
// AVOID — bare dayjs() uses system timezone
dayjs(date).format('MMMM DD, YYYY');

// ✅ CORRECT — uses Manila timezone
dayjs(date).tz().format('MMMM DD, YYYY');
// Or better: import { formatDisplayDate } from '@/utils/date';
```

---

## 8. Resolved Audit Findings (2026-04-12)

The following bugs were identified in the 3-pass timezone audit (2026-04-12) and were fixed in the follow-up implementation pass. The only remaining timezone-specific exception is the legacy notification timestamp convention in §9.

### 8.1 CRITICAL — Manual +8h Offset Hacks (Double-Offset Bug) ✅ FIXED

Five places manually added `8 * 60 * 60 * 1000` to `Date.getTime()` then called `.toISOString()`. The `Z` suffix claimed UTC while the value was already Manila time, so browsers/Node added +8h again on parse.

| File | Line | Context |
|------|------|---------|
| `src/app/api/backup/route.ts` | 669 | Folder name + manifest timestamp |
| `src/lib/backup/fullDumpBackupJob.ts` | 59 | Folder name |
| `scripts/backup-database.js` | 49 | `getManilaTimestamp()` folder name |
| `scripts/backup-database.js` | 157 | JSON backup `metadata.createdAt` |
| `scripts/backup-database.js` | 277 | Manifest `timestamp` field |

**Implemented fix** — backup folders now use real UTC timestamps and manifests store real UTC ISO strings:

```ts
// ✅ Filesystem-safe UTC folder timestamp
function buildBackupFolderTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

const folderName = `${buildBackupFolderTimestamp()}-full-backup`;
const manifestTimestamp = new Date().toISOString();
```

### 8.2 MEDIUM — Server-Side `new Date().toISOString().slice(0,10)` (Wrong Date Near Midnight) ✅ FIXED

Between 00:00–07:59 Manila time, `.toISOString()` returns the **previous UTC date**. Business dates silently default to yesterday.

| File | Line | Context |
|------|------|---------|
| `src/app/api/payroll/route.ts` | 13 | Default `paidDate` |
| `src/app/api/general-merchandise/payroll/route.ts` | 103 | GM default `paidDate` |
| `src/app/api/trucking/payroll/route.ts` | 27 | `getTodayDate()` |
| `src/app/api/employees/[id]/route.ts` | 303 | Default hire date |
| `src/app/api/trucking/employees/[id]/route.ts` | 294 | Default hire date |
| `src/app/api/customers/import/route.ts` | 196 | Default import date |
| `src/app/api/general-merchandise/customers/import/route.ts` | 188 | Default import date |
| `src/modules/shared/employees/leave-requests/api/serviceBase.ts` | 136 | Default `appliedDate` |

**Fix pattern:**

```ts
// ❌ WRONG — returns UTC date, off by 1 day 00:00–07:59 PHT
const today = new Date().toISOString().slice(0, 10);

// ✅ CORRECT — Manila-aware YYYY-MM-DD
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
}).format(new Date());

// ✅ OR use the existing utility
import { getCurrentDateISO } from '@/utils/date';
const today = getCurrentDateISO();
```

### 8.3 MEDIUM — Client-Side `new Date().toISOString().slice(0,10)` (Wrong Default Date Near Midnight) ✅ FIXED

Same UTC-date bug in browser code. User sees yesterday's date as the default between midnight and 8 AM Manila time.

| File | Lines | Context |
|------|-------|---------|
| `src/modules/clothing/operations/inventory/components/InventoryPage.tsx` | 94, 112, 118 | Posting date (3 instances) |
| `src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentSelection.ts` | 105, 130 | Posting date reset (2 instances) |
| `src/app/clothing/operations/customers/[id]/components/OrdersAndTransactions.tsx` | 64, 182 | Order/refund date (2 instances) |
| `src/modules/clothing/operations/customers/services/CustomerService.ts` | 151 | Customer export date |

**Fix pattern** — same as §8.2: use `getCurrentDateISO()` from `@/utils/date`.

### 8.4 MEDIUM — Backup Schedule Display Bugs ✅ FIXED

| File | Lines | Context |
|------|-------|---------|
| `src/modules/clothing/operations/settings/backup/hooks/useBackupSchedule.ts` | 57–70 | Naively adds 7/1 days to last run time instead of computing from schedule config |
| `src/modules/clothing/operations/settings/backup/types.ts` | 314–320 | `normalizeTimestamp()` appends `Z` to folder names that already contain fake-Manila time |

**Implemented fix:**
- `useBackupSchedule` now computes next due from cadence, schedule time, and day-of-week instead of adding `+1` / `+7` days to the last run.
- `normalizeTimestamp` now works correctly for newly generated backup folders because folder timestamps are stored as real UTC.

### 8.5 LOW — Cosmetic Filenames Using UTC Date ✅ FIXED

These only affected downloaded file names, not business data. They now use `getCurrentDateISO()` for Manila-aware filenames.

| File | Lines | Context |
|------|-------|---------|
| `src/modules/clothing/operations/customers/hooks/useCustomersCSV.ts` | 92, 115, 152 | CSV export filenames |
| `src/modules/trucking/operations/trips/hooks/useTripsDashboard.ts` | 74 | Trip export filename |
| `src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts` | 817 | Checkout links export |
| `src/app/personal/hooks/useHouseholdExpenses.ts` | 643, 654 | Household expense export |

---

## 9. Notification Timestamp Convention (Legacy)

Three places in the codebase store Manila time directly into PostgreSQL `timestamp` columns (without timezone), then read back with `timeZone: 'UTC'`:

- `src/modules/transactions/api/auditLogHelpers.ts` — audit log timestamps
- `src/modules/products/api/service.ts` — product update timestamps  
- `src/app/api/shipments/route.ts` — shipment operation timestamps

The notification read-back endpoints in `src/app/api/operations/notifications/route.ts` and `src/app/api/general-merchandise/operations/notifications/route.ts` use `timeZone: 'UTC'` on purpose to compensate.

> **Do not change these to `timeZone: 'Asia/Manila'`** — that would double the offset. This convention is fragile but working. Any new notification code should store proper UTC timestamps and read with `Asia/Manila`.

---

## 10. Test Assertions

When writing tests that assert formatted dates, use the standard format:

```ts
// ✅ CORRECT
expect(result.date).toBe('April 01, 2026');
expect(result.dateTime).toBe('April 01, 2026 · 12:00 AM');
expect(result.time).toBe('12:00 AM');

// ✅ For dayjs-formatted dates
expect(result.display).toBe('April 01, 2026');
expect(result.displayDateTime).toBe('April 01, 2026 · 12:00 AM');

// ❌ WRONG — old format
expect(result.date).toBe('Apr 1, 2026');
expect(result.dateTime).toBe('April 1, 2026 12:00 AM');
```

> Note: The middle dot separator ` · ` is U+00B7, not a regular period. Copy it from the constant `DATE_TIME_SEPARATOR` or from this document.

---

## 11. Completed Fixes (2026-04-12)

The following categories were fixed across the display-format standardization pass and the timezone-logic follow-up pass. All affected edits typecheck clean. See `CHECKLIST.md` for the complete item-by-item audit trail.

| Category | What Was Fixed | Files Touched |
|----------|---------------|---------------|
| Centralized formatters | All 7 formatter modules updated to standard format + `Asia/Manila` | 7 |
| Inline `month: 'short'` | Replaced with `month: 'long'` or centralized imports | 23 |
| Inline `month: 'long'` wrong day/separator | Fixed `day: '2-digit'`, dropped `weekday`, added timezone | 6 |
| Bare `.toLocaleDateString()` | Added explicit options + timezone | 5 |
| `dateStyle: 'medium'` / undefined locale | Replaced with standard Intl options + `'en-US'` locale | 3 |
| dayjs wrong patterns | Updated to `'MMMM DD, YYYY'` / `'MMMM DD, YYYY [·] hh:mm A'` | 10 |
| `formatLongDateUS()` consumers | Fixed at source — dropped weekday, added timezone | 4 |
| API payslip PDF routes | Replaced inline formatters with standard format | 3 |
| Display formatters missing timezone | Added `timeZone: 'Asia/Manila'` to all | 11 |
| Formatter functions missing timezone | Added `timeZone: 'Asia/Manila'` to 4 functions | 3 |
| Manual backup timestamp hacks | Switched backup folder/manifests from fake-Manila UTC to real UTC timestamps | 4 |
| Server business-date defaults | Replaced UTC date slicing with `getCurrentDateISO()` / `toISODate()` | 8 |
| Client default dates | Replaced UTC date slicing with `getCurrentDateISO()` | 4 |
| Backup schedule next-due logic | Computes next run from cadence/time/day-of-week config instead of naive day increments | 2 |
| Export filename dates | Replaced UTC filename dates with `getCurrentDateISO()` | 4 |

---

## 12. Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│  STANDARD FORMAT:  April 01, 2026 · 12:00 AM                   │
│  TIMEZONE:         Asia/Manila (PHT, UTC+8)                     │
│  LOCALE:           en-US                                        │
│  SEPARATOR:        " · " (U+00B7 middle dot)                   │
├─────────────────────────────────────────────────────────────────┤
│  Intl options:                                                  │
│    Date: { month:'long', day:'2-digit', year:'numeric',         │
│            timeZone:'Asia/Manila' }                              │
│    Time: { hour:'2-digit', minute:'2-digit', hour12:true,       │
│            timeZone:'Asia/Manila' }                              │
├─────────────────────────────────────────────────────────────────┤
│  dayjs patterns:                                                │
│    Date:     'MMMM DD, YYYY'                                    │
│    DateTime: 'MMMM DD, YYYY [·] hh:mm A'                       │
│    Time:     'hh:mm A'                                          │
│    Storage:  'YYYY-MM-DD'                                       │
├─────────────────────────────────────────────────────────────────┤
│  Primary import:                                                │
│    import { formatDateOnly, formatDateTimeFull }                 │
│      from '@/utils/dateFormatters';                              │
│    import { formatDisplayDate, getCurrentDateISO }               │
│      from '@/utils/date';                                       │
└─────────────────────────────────────────────────────────────────┘
```

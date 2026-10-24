# Date/Time Refactor Audit: April 2026

Historical sections extracted from the [canonical tracker](../../plans/REFACTOR_CHECKLIST.md)
on 2026-10-25. Completion labels and remaining findings are retained as dated
evidence; use the [current date/time rules](../../DATE_TIME_TIMEZONE_RULES.md) for policy.

## Date/Time And Timezone Consistency (2026-04-12)

Source: 3-pass repo-wide audit of all date/time/timezone handling. Target timezone is `Asia/Manila` (PHT, UTC+8).

### ~~1. CRITICAL — Manual +8h Offset Hacks (Double-Offset Bug)~~ ✅ DONE (2026-04-12)

~~These use `new Date(now.getTime() + 8 * 60 * 60 * 1000)` then `.toISOString()` which appends `Z` (UTC). When parsed back, browsers add +8h again — timestamps display 8 hours late.~~

- [x] `src/app/api/backup/route.ts` line 669 — folder name + manifest timestamp ✅ Switched backup folder/manifests to real UTC timestamps
- [x] `src/lib/backup/fullDumpBackupJob.ts` line 59 — folder name ✅ Switched dump backup folder naming to real UTC timestamps
- [x] `scripts/backup-database.js` line 49 — `getManilaTimestamp()` folder name ✅ Removed fake-Manila timestamp generation
- [x] `scripts/backup-database.js` line 157 — JSON backup `metadata.createdAt` ✅ Stores real UTC ISO timestamp
- [x] `scripts/backup-database.js` line 277 — manifest `timestamp` field ✅ Stores real UTC ISO timestamp

~~Fix: replace manual offset with `Intl.DateTimeFormat('en-CA', { timeZone })` approach already used in `scheduledBackupRunner.ts`.~~ Resolved by storing real UTC timestamps in backup artifacts and folder names.

### ~~2. MEDIUM — Server-Side `new Date().toISOString().slice(0,10)` (Wrong Date Near Midnight PHT)~~ ✅ DONE (2026-04-12)

~~Between 00:00–07:59 Manila time, `toISOString()` returns the previous UTC date. Business dates default to yesterday.~~

- [x] `src/app/api/payroll/route.ts` line 13 — default `paidDate` ✅ Uses `getCurrentDateISO()`
- [x] `src/app/api/general-merchandise/payroll/route.ts` line 103 — GM default `paidDate` ✅ Uses `getCurrentDateISO()`
- [x] `src/app/api/trucking/payroll/route.ts` line 27 — `getTodayDate()` ✅ Uses `getCurrentDateISO()` / `toISODate()`
- [x] `src/app/api/employees/[id]/route.ts` line 303 — default hire date ✅ Uses `getCurrentDateISO()` / `toISODate()` for schedule cutoff
- [x] `src/app/api/trucking/employees/[id]/route.ts` line 294 — default hire date ✅ Uses `getCurrentDateISO()` / `toISODate()` for schedule cutoff
- [x] `src/app/api/customers/import/route.ts` line 196 — default import date ✅ Uses `getCurrentDateISO()`
- [x] `src/app/api/general-merchandise/customers/import/route.ts` line 188 — default import date ✅ Uses `getCurrentDateISO()`
- [x] `src/modules/shared/employees/leave-requests/api/serviceBase.ts` line 136 — default `appliedDate` ✅ Uses `getCurrentDateISO()`

~~Fix: use `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())` for Manila-aware YYYY-MM-DD.~~ Done via shared `getCurrentDateISO()` / `toISODate()` helpers.

### ~~3. MEDIUM — Client-Side `new Date().toISOString().slice(0,10)` (Wrong Default Date Near Midnight)~~ ✅ DONE (2026-04-12)

~~Same UTC-date issue in browser code. User sees yesterday's date as the default between midnight and 8 AM PHT.~~

- [x] `src/modules/clothing/operations/inventory/components/InventoryPage.tsx` lines 94, 112, 118 — posting date (3 instances) ✅ Uses `getCurrentDateISO()`
- [x] `src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentSelection.ts` lines 105, 130 — posting date reset (2 instances) ✅ Uses `getCurrentDateISO()`
- [x] `src/app/clothing/operations/customers/[id]/components/OrdersAndTransactions.tsx` lines 64, 182 — order/refund date (2 instances) ✅ Uses `getCurrentDateISO()`
- [x] `src/modules/clothing/operations/customers/services/CustomerService.ts` line 151 — customer export date ✅ Uses `getCurrentDateISO()`

~~Fix: create a shared `getManilaDateString()` utility that uses `Intl.DateTimeFormat` with `Asia/Manila`.~~ Done via shared `getCurrentDateISO()`.

### 4. MEDIUM — Formatter Functions Missing Timezone

These work when the browser is in PHT but break if accessed from a different timezone.

- [x] `src/lib/payroll/formatters.ts` line 4 — `formatPayrollDate()` no timezone (used in 3 payroll hooks) ✅ Added `timeZone: 'Asia/Manila'`
- [x] `src/lib/accounting/formatters.ts` line 22 — `formatLongDateUS()` no timezone (used in 5 hooks) ✅ Added `timeZone: 'Asia/Manila'`
- [x] `src/services/FormatterService.ts` line 64 — `formatDate()` no timezone ✅ Added `timeZone: 'Asia/Manila'`
- [x] `src/services/FormatterService.ts` lines 116, 139 — `formatDateISO()` and `formatTime()` no timezone ✅ Added `timeZone: 'Asia/Manila'`

~~Fix: add `timeZone: 'Asia/Manila'` to each formatter's options object.~~ **DONE** (2026-04-12)

### ~~5. MEDIUM — Backup Schedule Display Bugs~~ ✅ DONE (2026-04-12)

- [x] `src/modules/clothing/operations/settings/backup/hooks/useBackupSchedule.ts` lines 57–70 — naively adds 7/1 days to last run time instead of computing from actual schedule config ✅ Now computes next due from cadence/time/day-of-week schedule config
- [x] `src/modules/clothing/operations/settings/backup/types.ts` lines 314–320 — `normalizeTimestamp()` appends `Z` to folder names that already contain fake-Manila time, compounding the double-offset ✅ Self-corrected by switching backup folder timestamps to real UTC

~~Fix: `useBackupSchedule` should compute next-due from schedule config (day-of-week, time, cadence). `normalizeTimestamp` will self-correct once the folder timestamps use real UTC.~~ **DONE**.

### 6. ~~LOW — Display Formatters Without Explicit Timezone~~ ✅ DONE (2026-04-12)

~~Work correctly in PHT browsers but inconsistent if accessed from other timezones.~~

- [x] `src/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet.ts` — `toDisplayDate()` ✅ Added `timeZone: 'Asia/Manila'`
- [x] `src/modules/trucking/operations/vehicle-assignments/components/VehicleAssignmentsTable.tsx` ✅ Replaced with `formatDateOnly` import
- [x] `src/modules/trucking/operations/fleet-registry/components/FleetRegistryTable.tsx` ✅ Replaced with `formatDateOnly` import
- [x] `src/modules/trucking/operations/trips/components/TripsTable.tsx` ✅ Added `timeZone: 'Asia/Manila'`
- [x] `src/modules/trucking/operations/fleet-registry/hooks/useFleetVehicleDetails.ts` ✅ Replaced with `formatDateOnly` import
- [x] `src/modules/_template/components/TemplateTable.tsx` ✅ Added `timeZone: 'Asia/Manila'`
- [x] Profile/user pages (4 instances) ✅ All now use `month: 'long', day: '2-digit', timeZone: 'Asia/Manila'`
- [x] `src/hooks/useVersionHistory.ts` ✅ CSV export timestamps now use standard format with timezone
- [x] `src/modules/clothing/operations/settings/change-log/components/ChangeLogPage.tsx` ✅ All 3 formatters now use `'en-US'` locale + `timeZone: 'Asia/Manila'`
- [x] `src/app/clothing/operations/notifications/NotificationsClientPage.tsx` ✅ Both formatters now use standard options + timezone
- [x] `src/modules/clothing/operations/checkout-links/components/tabs/LocalInvoicingTab.tsx` ✅ Added `timeZone: 'Asia/Manila'`

Fix: add `timeZone: 'Asia/Manila'` or switch to the existing `dateFormatter`/`dateFormatterShort` from `src/utils/dateFormatters.ts`.

### ~~7. LOW — Cosmetic Filenames Using UTC Date~~ ✅ DONE (2026-04-12)

~~These only affect downloaded file names, not business data.~~

- [x] `src/modules/clothing/operations/customers/hooks/useCustomersCSV.ts` lines 92, 115, 152 ✅ Uses `getCurrentDateISO()` for export filenames
- [x] `src/modules/trucking/operations/trips/hooks/useTripsDashboard.ts` line 74 ✅ Uses `getCurrentDateISO()` for export filenames
- [x] `src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts` line 817 ✅ Uses `getCurrentDateISO()` for export filenames
- [x] `src/app/personal/hooks/useHouseholdExpenses.ts` lines 643, 654 ✅ Uses `getCurrentDateISO()` for export filenames

### 8. INFO — Fragile But Working Notification Timestamp Workaround

Three places store Manila time directly into PostgreSQL `timestamp` columns then read back with `timeZone: 'UTC'`. Works today but any new reader using `Asia/Manila` will show +8h error.

- `src/modules/transactions/api/auditLogHelpers.ts` line 40
- `src/modules/products/api/service.ts` line 190
- `src/app/api/shipments/route.ts` line 182
- Read-back: `src/app/api/operations/notifications/route.ts` lines 14–27
- Read-back: `src/app/api/general-merchandise/operations/notifications/route.ts` lines 14–27

No fix needed now, but document the convention so future work doesn't break it.

### Already Correct

- `src/lib/formatters.ts` — `formatDateTime()` with `Asia/Manila` default
- `src/utils/dateFormatters.ts` — all 5 formatters specify `Asia/Manila`
- `src/services/FormatterService.ts` — `formatDateShort()` has `Asia/Manila`
- `src/lib/backup/scheduledBackupRunner.ts` — uses `Intl.DateTimeFormat` with configurable timezone
- `src/lib/backup/pitr.ts` — uses `Intl.DateTimeFormat` with timezone parameter
- `src/lib/transactions/constants.ts` — `MANILA_TIME_FORMATTER` and `MANILA_DATE_FORMATTER` both specify `Asia/Manila`

## Date/Time Display Format Standardization (2026-04-12)

Source: 3-pass repo-wide audit of all date/time display formatting in UI, PDFs, and API responses.

**Target format**: `April 01, 2026 · 12:00 AM`

- Date part: full month name, zero-padded day, 4-digit year (`month: 'long'`, `day: '2-digit'`, `year: 'numeric'`)
- Separator: `·` (middle dot U+00B7, not a period)
- Time part: zero-padded 12-hour, minutes, AM/PM (`hour: '2-digit'`, `minute: '2-digit'`, `hour12: true`)
- Always with `timeZone: 'Asia/Manila'`
- Date-only contexts: `April 01, 2026`
- Time-only contexts: `12:00 AM`

For dayjs: `'MMMM DD, YYYY'` (date-only), `'MMMM DD, YYYY · hh:mm A'` (datetime), `'hh:mm A'` (time-only).

### ~~1. Centralized Formatter Definitions — All Wrong~~ ✅ ALL FIXED (2026-04-12)

~~These are the core formatters imported by many modules. Fixing these propagates across all consumers.~~

**`src/utils/dateFormatters.ts`** — 5 formatters:

- [x] `dateFormatter`: now `month:'long', day:'2-digit'` ✅
- [x] `timeFormatter`: now `hour:'2-digit', minute:'2-digit'`, no seconds ✅
- [x] `timeFormatterShort`: now alias to `timeFormatter` ✅
- [x] `dateFormatterShort`: now alias to `dateFormatter` ✅
- [x] `dateTimeFormatter`: now custom `.format()` joining date+time with `·` ✅
- [x] `formatDateParts()` and `formatTimeString()` helpers updated ✅

**`src/services/FormatterService.ts`** — 4 methods:

- [x] `formatDate()`: now `day:'2-digit'` + `timeZone: 'Asia/Manila'` ✅
- [x] `formatDateShort()`: now `month:'long', day:'2-digit'` ✅
- [x] `formatTime()`: now `hour:'2-digit'` + timezone ✅
- [x] `formatDateTime()`: now joins with `·` separator ✅

**`src/lib/formatters.ts`**:

- [x] `formatDateTime()`: added `STANDARD_DATE_OPTIONS` and `STANDARD_TIME_OPTIONS` constants ✅

**`src/lib/transactions/constants.ts`** — 2 formatters:

- [x] `MANILA_TIME_FORMATTER`: now custom `.format()` joining with `·` ✅
- [x] `MANILA_DATE_FORMATTER`: now `month:'long', day:'2-digit'` ✅

**`src/lib/payroll/formatters.ts`**:

- [x] `formatPayrollDate()`: now `month:'long', day:'2-digit'` + timezone ✅

**`src/lib/accounting/formatters.ts`**:

- [x] `formatLongDateUS()`: dropped `weekday`, now `day:'2-digit'` + timezone ✅

**`src/utils/date.ts`** — dayjs-based:

- [x] `DATE_DISPLAY_FORMAT`: now `'MMMM DD, YYYY'` ✅
- [x] `formatDisplayDate()`: uses corrected default ✅
- [x] `formatDate()`: callers fixed to use standard patterns ✅
- [x] Added `DATETIME_DISPLAY_FORMAT = 'MMMM DD, YYYY [·] hh:mm A'` and `formatDisplayDateTime()` ✅

### ~~2. Inline Formatters With `month: 'short'` (Abbreviated Month)~~ ✅ ALL FIXED (2026-04-12)

~~All produce formats like "Oct 5, 2025" or "Oct 05, 2025" instead of target "October 05, 2025".~~

**Trucking tables** (define own inline `formatDate`):

- [x] `src/modules/trucking/operations/vehicle-assignments/components/VehicleAssignmentsTable.tsx` ✅
- [x] `src/modules/trucking/operations/fleet-registry/components/FleetRegistryTable.tsx` ✅
- [x] `src/modules/trucking/operations/fleet-registry/hooks/useFleetVehicleDetails.ts` ✅
- [x] `src/modules/trucking/operations/trips/components/TripsTable.tsx` ✅
- [x] `src/modules/_template/components/TemplateTable.tsx` ✅

**Clothing/GM payroll and employees:**

- [x] `src/modules/clothing/employees/payroll/components/EmployeePayrollPage.tsx` ✅
- [x] `src/modules/clothing/employees/payroll/hooks/payrollHookUtils.ts` ✅
- [x] `src/modules/clothing/operations/transactions/hooks/transactionDraftUtils.ts` ✅
- [x] `src/modules/clothing/operations/transactions/hooks/useTransactionsDerivedData.ts` ✅
- [x] `src/app/clothing/employees/employee-loans/hooks/employeeLoanUtils.ts` ✅
- [x] `src/app/clothing/employees/payroll/hooks/usePayrollPage.tsx` ✅
- [x] `src/app/clothing/employees/team/hooks/useEmployeeDetail.ts` ✅
- [x] `src/app/clothing/employees/team/hooks/useTeam.ts` ✅

**Trucking other:**

- [x] `src/app/trucking/analytics/profitability/page.tsx` ✅
- [x] `src/app/trucking/employees/payroll/lib/formatters.ts` ✅

**Accounting:**

- [x] `src/lib/accounting/date-utils.ts` (`buildPeriodLabel`) ✅
- [x] `src/app/clothing/accounting/profit-loss/components/ProfitLossDetailsTable.tsx` ✅

**Notifications/Settings:**

- [x] `src/modules/clothing/operations/checkout-links/components/tabs/LocalInvoicingTab.tsx` ✅
- [x] `src/modules/clothing/operations/settings/components/TransactionsSettingsTab.tsx` ✅
- [x] `src/app/clothing/operations/notifications/NotificationsClientPage.tsx` ✅
- [x] `src/app/api/operations/notifications/route.ts` ✅
- [x] `src/app/api/general-merchandise/operations/notifications/route.ts` ✅

**Backup UI:**

- [x] `src/modules/clothing/operations/settings/backup/types.ts` (`formatBackupTimestamp`) ✅

### ~~3. Inline Formatters With `month: 'long'` But Wrong Day/Separator/Timezone~~ ✅ ALL FIXED (2026-04-12)

~~These have the right month name but wrong day padding, include weekday, or missing timezone.~~

- [x] `src/app/clothing/accounting/ledger/components/OpeningBalancePanel.tsx` ✅
- [x] `src/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet.ts` ✅
- [x] `src/app/trucking/employees/team/components/SalaryTimeline.tsx` ✅
- [x] `src/modules/clothing/operations/transactions/hooks/usePackingListGeneration.ts` ✅
- [x] `src/app/api/generate-invoice/route.ts` ✅
- [x] `src/app/api/generate-in-transit-invoice/route.ts` ✅

### ~~4. Bare `.toLocaleDateString()` — No Options At All~~ ✅ ALL FIXED (2026-04-12)

~~These use browser locale defaults, producing unpredictable formats like "10/12/2025" or "12/10/2025".~~

- [x] `src/app/profile/page.tsx` ✅
- [x] `src/modules/auth/profile/components/ProfileMeta.tsx` ✅
- [x] `src/modules/shared/user-management/components/UserManagementTable.tsx` ✅
- [x] `src/modules/admin/users/components/UsersTable.tsx` ✅
- [x] `src/hooks/useVersionHistory.ts` ✅

### ~~5. `dateStyle: 'medium'` And Locale `undefined` Formatters~~ ✅ ALL FIXED (2026-04-12)

~~Use browser defaults, output varies by environment.~~

- [x] `src/modules/clothing/operations/settings/change-log/components/ChangeLogPage.tsx` — `TIMESTAMP_FORMATTER` ✅
- [x] `src/modules/clothing/operations/settings/change-log/components/ChangeLogPage.tsx` — `SUMMARY_DATE_FORMATTER` ✅
- [x] `src/modules/clothing/operations/settings/change-log/components/ChangeLogPage.tsx` — `SUMMARY_TIME_FORMATTER` ✅

### ~~6. dayjs `.format()` With Wrong Pattern~~ ✅ ALL FIXED (2026-04-12)

**Leave tracker (dayjs with `Asia/Manila`):**

- [x] `src/app/clothing/employees/leave-tracker/hooks/useLeaveTracker.ts` ✅

**Employee dashboard (dayjs with `Asia/Manila`):**

- [x] `src/app/clothing/employees/dashboard/hooks/useEmployeeDashboard.ts` ✅
- [x] `src/modules/clothing/employees/dashboard/hooks/useEmployeeDashboard.tsx` ✅

**`formatDisplayDate()` callers overriding with `'MMM D, YYYY'`:**

- [x] `src/app/clothing/employees/attendance/hooks/useAttendance.ts` ✅
- [x] `src/app/clothing/employees/cash-advance/hooks/useCashAdvance.ts` ✅
- [x] `src/app/clothing/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay.ts` ✅

**Profit-loss chart labels:**

- [x] `src/app/clothing/accounting/profit-loss/components/ProfitLossBreakdownsPanel.tsx` ✅

**Dispatch ship timestamps:**

- [x] `src/modules/clothing/operations/dispatch/components/RecentlyUpdatedTab.tsx` ✅
- [x] `src/modules/clothing/operations/dispatch/components/CheckoutUpdateTab.tsx` ✅

**Customer detail page:**

- [x] `src/app/clothing/operations/customers/[id]/utils.tsx` ✅

### ~~7. Accounting Hooks Wrapping `formatLongDateUS()` — Includes Weekday~~ ✅ ALL FIXED (2026-04-12)

~~These all delegate to `formatLongDateUS()` which was fixed at the source to produce the standard format.~~

- [x] `src/app/clothing/accounting/hooks/useExpenses.ts` ✅
- [x] `src/app/clothing/accounting/journal/hooks/useJournal.ts` ✅
- [x] `src/app/clothing/accounting/ledger/hooks/useLedger.ts` ✅
- [x] `src/app/personal/hooks/useHouseholdExpenses.ts` ✅

### ~~8. API Payslip PDF Routes — Inconsistent Date + Time Combo~~ ✅ ALL FIXED (2026-04-12)

~~All 3 division routes fixed to use standard format with `Asia/Manila` timezone.~~

- [x] `src/app/api/payroll/generate-payslips/route.ts` ✅
- [x] `src/app/api/trucking/payroll/generate-payslips/route.ts` ✅
- [x] `src/app/api/general-merchandise/payroll/generate-payslips/route.ts` ✅

### 9. Exempt — Do NOT Standardize

These have legitimate reasons to use non-standard formats:

- Calendar month navigation headers (`CalendarView.tsx`): "October 2025" — `month:'long', year:'numeric'`
- Chart monthly/quarterly bucket labels (`ProfitLossBreakdownsPanel.tsx`): "Oct 2025" — `'MMM YYYY'`
- Chart x-axis month labels (`useBusinessIntelligence.ts`): "Jan", "Feb" — `month:'short'` only
- Date range shorthand in leave tracker: "Oct 05 - 12, 2025" — compact range display (but should still use long month)
- Relative time (`timeAgo`): "3 hours ago" — via dayjs `fromNow()`
- ISO date keys for storage/automation: `'YYYY-MM-DD'` — not display
- Backup folder name timestamps: `en-CA` format for filesystem — not display
- CSV filename timestamps: cosmetic only, tracked in timezone audit §7

### ~~Implementation Strategy~~ ✅ COMPLETED (2026-04-12)

~~All steps below were implemented across 64 files. All 464 affected tests pass. TypeScript typecheck clean.~~

1. ~~**Fix centralized formatters FIRST** (§1) — this propagates to all consumers automatically~~
2. ~~**Replace inline formatters with centralized imports** (§2–§6) — eliminate duplication~~
3. ~~**For `Intl.DateTimeFormat`**: format date and time separately, join with `·` since Intl doesn't support custom separators~~
4. ~~**For dayjs**: update `DATE_DISPLAY_FORMAT` to `'MMMM DD, YYYY'` and create `DATETIME_DISPLAY_FORMAT = 'MMMM DD, YYYY · hh:mm A'`~~
5. ~~**Update test assertions** that match old format strings (test files in leave-tracker, employee-loans, schedules, team tests)~~

### Working Rules For Continuous Execution

- Work top-to-bottom unless a higher item is blocked by domain risk or missing tests.
- For each family, complete route extraction, parity tests, and any required docs updates in the same batch.
- If a family turns out to be more divergent than expected, downgrade it here with a short note instead of forcing a bad abstraction.
- When a shared factory already exists, prefer adoption and cleanup before inventing a second adapter pattern.

## Notes

- This checklist tracks both planning work already completed and implementation work still pending.
- Only real execution work should use unchecked checkboxes. Reference rules and guardrails should remain plain bullets.
- Mark items in `Completed`, `In Progress`, and `Pending` as work advances.
- For accounting and inventory refactors, do not change behavior until domain differences are explicitly mapped and tested.

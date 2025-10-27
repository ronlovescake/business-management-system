# Archives Directory

This directory contains old migration scripts and temporary files that are no longer actively used but are kept for reference.

## Directory Structure

### `/migration-scripts/`

Contains old database migration and data generation scripts that were used during initial setup and data migration phases.

**Files:**

- `check-duplicates.sql` - SQL script to check for duplicate records
- `clear-and-reset.sql` - Database reset script (use with caution!)
- `clear-schedules.sql` - Script to clear schedule data
- `clean-duplicate-attendance.js` - Script to remove duplicate attendance records
- `generate-attendance-2025.js` - 2025 attendance data generator
- `generate-attendance-direct.js` - Direct attendance record generator
- `generate-attendance-from-schedules.js` - Generate attendance from schedules
- `generate-schedules-2025.js` - 2025 schedule data generator
- `upload-schedules-batch.js` - Batch schedule uploader
- `upload-schedules-fixed.js` - Fixed schedule uploader

**Status:** ✅ Completed - No longer needed for regular operations

### `/temp-scripts/`

Contains temporary validation and debugging scripts.

**Files:**

- `tmp-check.js` - Customer CSV validation script

**Status:** ✅ Archived - Was used for one-off customer data validation

## Notes

- These scripts should NOT be used in production
- They are kept for historical reference and potential data recovery scenarios
- If you need to perform similar operations, consider creating new, updated scripts
- Some scripts contain hardcoded data specific to the migration period

## Archive Date

Archived on: October 27, 2025
Archived by: Automated cleanup (Task 15: Duplicate/Old Code Files)

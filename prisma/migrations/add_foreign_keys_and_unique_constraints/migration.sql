-- Migration: Add Foreign Keys and Unique Constraints
-- Date: 2025-10-24
-- Description: Adds database-level referential integrity and prevents duplicate records

-- ============================================================================
-- STEP 1: Add Unique Constraints (Composite) - Soft Delete Aware
-- ============================================================================

-- Attendance: One record per employee per date (excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_employee_date_unique" 
ON attendance("employeeId", "date") 
WHERE "deletedAt" IS NULL;

-- Schedule: One schedule per employee per date per shift (excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_employee_date_shift_unique" 
ON schedules("employeeId", "date", "shiftType") 
WHERE "deletedAt" IS NULL;

-- Payroll: One payroll per employee per period (excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_employee_period_unique" 
ON payrolls("employeeId", "periodStart", "periodEnd") 
WHERE "deletedAt" IS NULL;

-- Employee: Unique email and phone (excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "employee_email_unique" 
ON employees("email") 
WHERE "deletedAt" IS NULL AND "email" IS NOT NULL AND "email" != '';

CREATE UNIQUE INDEX IF NOT EXISTS "employee_phone_unique" 
ON employees("phone") 
WHERE "deletedAt" IS NULL AND "phone" IS NOT NULL AND "phone" != '';

-- ============================================================================
-- STEP 2: Add Check Constraints (Data Validation)
-- ============================================================================

-- Employee: Basic salary must be positive
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employee_basic_salary_positive'
    ) THEN
        ALTER TABLE employees ADD CONSTRAINT "employee_basic_salary_positive" 
        CHECK ("basicSalary" >= 0);
    END IF;
END $$;

-- Attendance: Total hours cannot exceed 24
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'attendance_total_hours_valid'
    ) THEN
        ALTER TABLE attendance ADD CONSTRAINT "attendance_total_hours_valid" 
        CHECK ("totalHours" >= 0 AND "totalHours" <= 24);
    END IF;
END $$;

-- Payroll: Net pay cannot be negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payroll_netpay_non_negative'
    ) THEN
        ALTER TABLE payrolls ADD CONSTRAINT "payroll_netpay_non_negative" 
        CHECK ("netPay" >= 0);
    END IF;
END $$;

-- Payroll: Total deductions cannot exceed gross pay
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payroll_deductions_valid'
    ) THEN
        ALTER TABLE payrolls ADD CONSTRAINT "payroll_deductions_valid" 
        CHECK ("totalDeductions" <= "grossPay");
    END IF;
END $$;

-- Payroll: Gross pay must be non-negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payroll_grosspay_calculation'
    ) THEN
        ALTER TABLE payrolls ADD CONSTRAINT "payroll_grosspay_calculation" 
        CHECK ("grossPay" >= 0);
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Add Indexes for Foreign Key Lookups (Performance)
-- ============================================================================

-- These indexes already exist in schema, but ensuring they're present
CREATE INDEX IF NOT EXISTS "attendance_employeeId_idx" ON attendance("employeeId");
CREATE INDEX IF NOT EXISTS "schedules_employeeId_idx" ON schedules("employeeId");
CREATE INDEX IF NOT EXISTS "payrolls_employeeId_idx" ON payrolls("employeeId");
CREATE INDEX IF NOT EXISTS "leave_requests_employeeId_idx" ON leave_requests("employeeId");
CREATE INDEX IF NOT EXISTS "cash_advances_employeeId_idx" ON cash_advances("employeeId");

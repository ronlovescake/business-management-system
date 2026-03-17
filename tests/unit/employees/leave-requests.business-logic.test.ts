import { describe, it, expect, beforeAll } from 'vitest';
import {
  validateCreateLeaveRequest,
  validateUpdateLeaveRequest,
  validateBatchCreate,
  formatZodError,
} from '@/modules/clothing/employees/leave-requests/api/validation';
import { z } from 'zod';

const validCreate = {
  employeeId: 'emp-001',
  employeeName: 'Maria Santos',
  leaveType: 'Sick Leave',
  startDate: '2026-03-10',
  endDate: '2026-03-12',
  reason: 'Medical appointment',
};

// ──────────────────────────────────────────────────────────
// validateCreateLeaveRequest
// ──────────────────────────────────────────────────────────

describe('validateCreateLeaveRequest', () => {
  it('returns success for valid input', () => {
    const result = validateCreateLeaveRequest(validCreate);
    expect(result.success).toBe(true);
  });

  it('returns the parsed data on success', () => {
    const result = validateCreateLeaveRequest(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBe('emp-001');
      expect(result.data.employeeName).toBe('Maria Santos');
    }
  });

  it('applies default status of "pending"', () => {
    const result = validateCreateLeaveRequest(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
    }
  });

  it('applies default paymentStatus of "unpaid"', () => {
    const result = validateCreateLeaveRequest(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentStatus).toBe('unpaid');
    }
  });

  it('calculates numberOfDays when not provided', () => {
    const result = validateCreateLeaveRequest(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      // March 10–12 = 3 days (inclusive)
      expect(result.data.numberOfDays).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses provided numberOfDays when given', () => {
    const result = validateCreateLeaveRequest({
      ...validCreate,
      numberOfDays: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.numberOfDays).toBe(5);
    }
  });

  it('returns failure when employeeId is missing', () => {
    const result = validateCreateLeaveRequest({
      ...validCreate,
      employeeId: '',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure when employeeName is missing', () => {
    const result = validateCreateLeaveRequest({
      ...validCreate,
      employeeName: '',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure when leaveType is missing', () => {
    const result = validateCreateLeaveRequest({
      ...validCreate,
      leaveType: '',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure when startDate is missing', () => {
    const result = validateCreateLeaveRequest({
      ...validCreate,
      startDate: '',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure when reason is missing', () => {
    const result = validateCreateLeaveRequest({ ...validCreate, reason: '' });
    expect(result.success).toBe(false);
  });

  it('returns failure for invalid status value', () => {
    const result = validateCreateLeaveRequest({
      ...validCreate,
      status: 'unknown',
    });
    expect(result.success).toBe(false);
  });

  it('sets appliedDate when not provided', () => {
    const result = validateCreateLeaveRequest(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appliedDate).toBeTruthy();
    }
  });
});

// ──────────────────────────────────────────────────────────
// validateUpdateLeaveRequest
// ──────────────────────────────────────────────────────────

describe('validateUpdateLeaveRequest', () => {
  it('returns success for an empty update (all fields optional)', () => {
    const result = validateUpdateLeaveRequest({});
    expect(result.success).toBe(true);
  });

  it('returns success for a partial update', () => {
    const result = validateUpdateLeaveRequest({ status: 'approved' });
    expect(result.success).toBe(true);
  });

  it('returns the parsed partial data', () => {
    const result = validateUpdateLeaveRequest({
      status: 'rejected',
      notes: 'Not approved',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('rejected');
    }
  });

  it('returns failure for invalid status', () => {
    const result = validateUpdateLeaveRequest({ status: 'revoked' });
    expect(result.success).toBe(false);
  });

  it('calculates numberOfDays when updating dates without providing numberOfDays', () => {
    const result = validateUpdateLeaveRequest({
      startDate: '2026-03-01',
      endDate: '2026-03-05',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // numberOfDays should be auto-calculated
      expect(result.data.numberOfDays).toBeGreaterThanOrEqual(1);
    }
  });
});

// ──────────────────────────────────────────────────────────
// validateBatchCreate
// ──────────────────────────────────────────────────────────

describe('validateBatchCreate', () => {
  it('validates an array of valid leave requests', () => {
    const result = validateBatchCreate([
      validCreate,
      { ...validCreate, employeeId: 'emp-002' },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('wraps a single object into an array', () => {
    const result = validateBatchCreate(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });

  it('returns failure when one item in the batch is invalid', () => {
    const result = validateBatchCreate([
      validCreate,
      { ...validCreate, employeeId: '' },
    ]);
    expect(result.success).toBe(false);
  });

  it('returns failure for an empty array', () => {
    const result = validateBatchCreate([]);
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// formatZodError
// ──────────────────────────────────────────────────────────

describe('formatZodError', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().positive('Age must be positive'),
  });

  let zodError: z.ZodError;

  beforeAll(() => {
    const result = schema.safeParse({ name: '', age: -1 });
    if (!result.success) {
      zodError = result.error;
    }
  });

  it('returns an object with "error" key', () => {
    const result = formatZodError(zodError);
    expect(result.error).toBe('Validation failed');
  });

  it('returns a "details" string with all error paths', () => {
    const result = formatZodError(zodError);
    expect(result.details).toContain('name');
    expect(result.details).toContain('age');
  });

  it('returns a "validationErrors" record keyed by field path', () => {
    const result = formatZodError(zodError);
    expect(result.validationErrors).toHaveProperty('name');
    expect(result.validationErrors).toHaveProperty('age');
  });

  it('stores field-level error messages in validationErrors', () => {
    const result = formatZodError(zodError);
    expect(result.validationErrors.name).toBe('Name is required');
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRestoreRecord = vi.hoisted(() => vi.fn());
const mockBulkRestore = vi.hoisted(() => vi.fn());
const mockFindDeletedRecords = vi.hoisted(() => vi.fn());

vi.mock('@/lib/safety/restore', () => ({
  restoreRecord: mockRestoreRecord,
  bulkRestore: mockBulkRestore,
  findDeletedRecords: mockFindDeletedRecords,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));

import { POST, GET, PUT } from '@/app/api/employees/restore/route';

const UUID_ONE = '550e8400-e29b-41d4-a716-446655440000';
const UUID_TWO = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('Employees Restore API - POST /api/employees/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores an employee successfully', async () => {
    mockRestoreRecord.mockResolvedValue({
      success: true,
      record: { id: 1, employeeId: 'EMP-0001' },
      warnings: ['Phone already used'],
    });

    const request = new NextRequest('http://localhost/api/employees/restore', {
      method: 'POST',
      body: JSON.stringify({ id: UUID_ONE }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.record).toEqual({ id: 1, employeeId: 'EMP-0001' });
    expect(payload.data.warnings).toEqual(['Phone already used']);
    expect(mockRestoreRecord).toHaveBeenCalledWith({
      model: 'employee',
      id: UUID_ONE,
      reason: undefined,
      userId: undefined,
    });
  });

  it('returns validation errors for invalid payload', async () => {
    const request = new NextRequest('http://localhost/api/employees/restore', {
      method: 'POST',
      body: JSON.stringify({ id: 'not-a-uuid' }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.validationErrors.id).toBe('Invalid record ID format');
    expect(mockRestoreRecord).not.toHaveBeenCalled();
  });

  it('bubbles up restore failures with 400', async () => {
    mockRestoreRecord.mockResolvedValue({
      success: false,
      error: 'Record not found',
    });

    const request = new NextRequest('http://localhost/api/employees/restore', {
      method: 'POST',
      body: JSON.stringify({ id: UUID_ONE }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Record not found');
  });
});

describe('Employees Restore API - GET /api/employees/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists soft-deleted employees with optional filters', async () => {
    mockFindDeletedRecords.mockResolvedValue([
      { id: 1, department: 'IT', deletedAt: new Date() },
      { id: 2, department: 'IT', deletedAt: new Date() },
    ]);

    const request = new NextRequest(
      'http://localhost/api/employees/restore?limit=1&department=IT'
    );

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.count).toBe(1);
    expect(payload.data.total).toBe(2);
    expect(payload.data.data).toHaveLength(1);
    expect(mockFindDeletedRecords).toHaveBeenCalledWith('employee', {
      department: 'IT',
    });
  });

  it('returns 500 when listing fails', async () => {
    mockFindDeletedRecords.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/employees/restore');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Failed to list deleted employees');
  });
});

describe('Employees Restore API - PUT /api/employees/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bulk restores employees successfully', async () => {
    mockBulkRestore.mockResolvedValue({
      success: 2,
      failed: 0,
      errors: [],
    });

    const request = new NextRequest('http://localhost/api/employees/restore', {
      method: 'PUT',
      body: JSON.stringify({ ids: [UUID_ONE, UUID_TWO], userId: 'user-123' }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.success).toBe(2);
    expect(payload.data.failed).toBe(0);
    expect(mockBulkRestore).toHaveBeenCalledWith(
      'employee',
      [UUID_ONE, UUID_TWO],
      'user-123'
    );
  });

  it('returns multi-status when some records fail', async () => {
    mockBulkRestore.mockResolvedValue({
      success: 1,
      failed: 1,
      errors: [{ id: UUID_ONE, error: 'Record not found' }],
    });

    const request = new NextRequest('http://localhost/api/employees/restore', {
      method: 'PUT',
      body: JSON.stringify({ ids: [UUID_ONE], userId: 'user-123' }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(207);
    expect(payload.success).toBe(true);
    expect(payload.data.failed).toBe(1);
    expect(payload.data.errors).toEqual([
      { id: UUID_ONE, error: 'Record not found' },
    ]);
  });

  it('validates bulk payloads', async () => {
    const request = new NextRequest('http://localhost/api/employees/restore', {
      method: 'PUT',
      body: JSON.stringify({ ids: [] }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.validationErrors.ids).toBe('At least one ID required');
    expect(mockBulkRestore).not.toHaveBeenCalled();
  });
});

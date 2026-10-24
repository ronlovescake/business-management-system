import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api/response';
import { withErrorHandler } from '@/core/api/middleware';
import { getRequiredRolesForPath } from '@/core/routePermissions';
import { GET as employeeDashboard } from '@/app/api/clothing/employees/dashboard/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const database = vi.hoisted(() => ({ attendance: { findMany: vi.fn() } }));
vi.mock('@/lib/auth/session', () => auth);
vi.mock('@/lib/db', () => ({ prisma: database }));

const protectedPaths = [
  '/api/expenses',
  '/api/employees',
  '/api/payroll/generate',
  '/api/attendance',
  '/api/schedules',
  '/api/leave-requests',
  '/api/cash-advances',
  '/api/thirteenth-month-pay',
  '/api/employee-automation-settings',
  '/api/accounting/ledger',
  '/api/accounting/manual-journal',
  '/api/clothing/employees/dashboard',
  '/api/products/transit-build',
  '/api/shipments/1/transit-build',
  '/api/shipments/1/transit-reclass',
];

describe('clothing server-side API authorization', () => {
  it('returns a retryable conflict for a rolled-back serializable transaction', async () => {
    auth.getCurrentUser.mockResolvedValue({ id: '1', role: 'ADMIN' });
    const handler = withErrorHandler(async () => {
      throw Object.assign(new Error('serialization conflict'), {
        code: 'P2034',
      });
    });
    const response = await handler(
      new NextRequest(getTestApiUrl('/api/shipments/1/transit-build'))
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('retry');
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each(protectedPaths)(
    'denies anonymous and USER requests before business work on %s',
    async (path) => {
      const businessWork = vi.fn(async () => ApiResponse.success({ ok: true }));
      const handler = withErrorHandler(businessWork);
      const request = new NextRequest(getTestApiUrl(path));
      auth.getCurrentUser.mockResolvedValue(null);
      expect((await handler(request)).status).toBe(401);
      auth.getCurrentUser.mockResolvedValue({ id: '1', role: 'USER' });
      expect((await handler(request)).status).toBe(403);
      expect(businessWork).not.toHaveBeenCalled();
    }
  );

  it.each(['ADMIN', 'SUPER_ADMIN'])(
    'allows %s on all protected paths',
    async (role) => {
      auth.getCurrentUser.mockResolvedValue({ id: '1', role });
      const businessWork = vi.fn(async () => ApiResponse.success({ ok: true }));
      const handler = withErrorHandler(businessWork);
      for (const path of protectedPaths) {
        expect(
          (await handler(new NextRequest(getTestApiUrl(path)))).status
        ).toBe(200);
      }
      expect(businessWork).toHaveBeenCalledTimes(protectedPaths.length);
    }
  );

  it.each([null, { id: '1', role: 'USER' }])(
    'guards the real employee dashboard before database reads',
    async (user) => {
      auth.getCurrentUser.mockResolvedValue(user);
      expect(
        (
          await employeeDashboard(
            new NextRequest(getTestApiUrl('/api/clothing/employees/dashboard'))
          )
        ).status
      ).toBe(user ? 403 : 401);
      expect(database.attendance.findMany).not.toHaveBeenCalled();
    }
  );

  it('preserves normal operational access and uses segment-bounded prefixes', async () => {
    expect(getRequiredRolesForPath('/clothing/operations/products')).toContain(
      'USER'
    );
    expect(getRequiredRolesForPath('/api/products')).toBeNull();
    expect(getRequiredRolesForPath('/api/shipments/1')).toBeNull();
    expect(getRequiredRolesForPath('/api/accounting-other')).toBeNull();
  });
});

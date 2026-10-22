import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createThirteenthMonthPayRoutes,
  type ThirteenthMonthPayRouteService,
} from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';
import type { CalculatedThirteenthMonthPayRecord } from '@/modules/shared/employees/thirteenth-month-pay/api/calculations';

type MockRecord = {
  id: string;
  recordId?: string;
  status?: string;
  [key: string]: unknown;
};

const calculatedRecord: CalculatedThirteenthMonthPayRecord = {
  id: 'emp-001-2025',
  employee: 'Avery Worker',
  employmentStatus: 'Active',
  year: '2025',
  hireDate: '2020-01-01',
  tenureship: '5 years',
  totalBasicSalary: 30000,
  totalLwop: 1000,
  totalAbsencesLates: 500,
  netBasicSalary: 28500,
  monthsWorked: 2,
  thirteenthMonthPay: 2375,
  status: 'calculated',
};

function createService(existing: MockRecord | null = null) {
  const service: ThirteenthMonthPayRouteService<
    MockRecord,
    Record<string, unknown>
  > = {
    findAll: vi.fn(async () => []),
    findWithFilters: vi.fn(async () => []),
    findByRecordId: vi.fn(async () => existing),
    create: vi.fn(async (data) => ({ id: 'persisted-id', ...data })),
    update: vi.fn(async (id, data) => ({ id, ...data })),
    updateStatusByRecordId: vi.fn(async (recordId, status) => ({
      id: recordId,
      status,
    })),
  };
  return service;
}

function createPatchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/thirteenth-month-pay', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

describe('thirteenth-month calculated status writes', () => {
  it('persists the server-calculated values on first approval', async () => {
    const service = createService();
    const calculateRecords = vi.fn(async () => [calculatedRecord]);
    const { PATCH } = createThirteenthMonthPayRoutes(service, {
      calculateRecords,
    });

    const response = await PATCH(
      createPatchRequest({
        id: calculatedRecord.id,
        status: 'approved',
        approvedDate: '2025-12-20',
      })
    );

    expect(response.status).toBe(200);
    expect(calculateRecords).toHaveBeenCalledOnce();
    expect(service.create).toHaveBeenCalledWith({
      recordId: 'emp-001-2025',
      employeeId: 'emp-001',
      employeeName: 'Avery Worker',
      year: 2025,
      status: 'approved',
      totalBasicSalary: 30000,
      totalLwop: 1000,
      totalAbsencesLates: 500,
      netBasicSalary: 28500,
      monthsWorked: 2,
      thirteenthMonthPay: 2375,
      notes: null,
      calculatedDate: null,
      approvedDate: '2025-12-20',
      paidDate: null,
    });
  });

  it('preserves approved amounts when marking a record paid', async () => {
    const service = createService({
      id: 'persisted-id',
      recordId: calculatedRecord.id,
      status: 'approved',
      thirteenthMonthPay: 2375,
    });
    const calculateRecords = vi.fn(async () => [calculatedRecord]);
    const { PATCH } = createThirteenthMonthPayRoutes(service, {
      calculateRecords,
    });

    const response = await PATCH(
      createPatchRequest({
        id: calculatedRecord.id,
        status: 'paid',
        paidDate: '2025-12-25',
      })
    );

    expect(response.status).toBe(200);
    expect(calculateRecords).not.toHaveBeenCalled();
    expect(service.update).toHaveBeenCalledWith('persisted-id', {
      status: 'paid',
      paidDate: '2025-12-25',
    });
  });
});

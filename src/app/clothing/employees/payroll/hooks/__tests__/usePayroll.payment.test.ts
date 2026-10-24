import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayroll } from '../usePayroll';

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  update: vi.fn(),
  fire: vi.fn(),
  payrolls: [] as Array<Record<string, unknown>>,
}));
vi.mock('@/lib/api/client', () => ({ api: { patch: mocks.patch } }));
vi.mock('@/lib/alerts', () => ({
  getSwal: async () => ({
    fire: mocks.fire,
    close: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn(),
  }),
}));
vi.mock('@/hooks/usePayrollBase', () => ({
  usePayrollBase: () => ({
    employeeOptions: [],
    resolveEmployeeRecord: vi.fn(),
    payrollQueryKey: ['payroll'],
    payrolls: mocks.payrolls,
    filteredPayrolls: mocks.payrolls,
  }),
}));
vi.mock('@/hooks/usePayrollCrudActions', () => ({
  usePayrollCrudActions: () => ({
    updateMutation: { mutateAsync: mocks.update },
  }),
}));

const payroll = {
  id: 'payroll-1',
  employee: 'Test Employee',
  employeeId: 'EMP-001',
  payPeriod: '2026-12-01 to 2026-12-15',
  periodStart: '2026-12-01',
  periodEnd: '2026-12-15',
  thirteenthMonth: 1000,
  netPay: 5000,
  status: 'approved',
};

describe('clothing payroll payment sync failures', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.payrolls = [payroll];
    mocks.fire.mockResolvedValue({ isConfirmed: true });
    mocks.patch.mockRejectedValue(new Error('13th month update failed'));
    mocks.update.mockResolvedValue(undefined);
  });

  it('does not mark a single payroll paid when 13th month sync fails', async () => {
    const { result } = renderHook(() => usePayroll());
    await act(async () => result.current.handleMarkAsPaid(payroll.id));
    expect(mocks.patch).toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.fire).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Error' })
    );
  });

  it('reports the failed bulk record instead of counting it as paid', async () => {
    const { result } = renderHook(() => usePayroll());
    await act(async () => result.current.handleMarkAllAsPaid());
    expect(mocks.patch).toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.fire).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Partial Success',
        text: expect.stringContaining('Updated 0 record(s)'),
      })
    );
  });

  it('still marks payroll without 13th month paid without a sync request', async () => {
    mocks.payrolls = [{ ...payroll, thirteenthMonth: 0 }];
    const { result } = renderHook(() => usePayroll());
    await act(async () => result.current.handleMarkAsPaid(payroll.id));
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: payroll.id, status: 'paid' })
    );
  });
});

import { useMutation, type QueryKey } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { getCurrentDateISO } from '@/utils/date';
import { getSwal } from '@/lib/alerts';
import type {
  EmployeeDirectoryEntry,
  PayrollRecord,
} from '@/hooks/usePayrollBase';

type PayrollFormLike = {
  employee: string;
  payPeriod: string;
  basicSalary: string;
  allowance: string;
  overtime: string;
  bonuses: string;
  thirteenthMonth: string;
  sss: string;
  philHealth: string;
  pagIbig: string;
  tax: string;
  loans: string;
  cashAdvance: string;
  lwop: string;
  absentsLates: string;
  bankGcash: string;
};

type PayrollTotals = {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

type UsePayrollCrudActionsOptions<TPayroll extends PayrollRecord> = {
  payrollQueryKey: QueryKey;
  resolveApiPath: (path: string) => string;
  getQueryData: () => TPayroll[] | undefined;
  setQueryData: (updater: (previous: TPayroll[]) => TPayroll[]) => void;
  invalidateQuery: () => void;
  cancelQuery: () => Promise<void>;
  editingPayroll: TPayroll | null;
  setEditingPayroll: (payroll: TPayroll | null) => void;
  setIsFormOpen: (open: boolean) => void;
  calculateTotals: (formData: PayrollFormLike) => PayrollTotals;
  resolveEmployeeRecord: (
    identifier: string | undefined | null
  ) => EmployeeDirectoryEntry | undefined;
};

const createOptimisticPayroll = <TPayroll extends PayrollRecord>(
  payload: Record<string, unknown>
): TPayroll => {
  return {
    id: `temp-${Date.now()}`,
    employee: String(payload.employeeName ?? ''),
    employeeId: payload.employeeId ? String(payload.employeeId) : null,
    payPeriod: String(payload.payPeriod ?? ''),
    basicSalary: Number(payload.basicSalary ?? 0),
    allowance: Number(payload.allowance ?? 0),
    overtime: Number(payload.overtime ?? 0),
    bonuses: Number(payload.bonuses ?? 0),
    thirteenthMonth: Number(payload.thirteenthMonth ?? 0),
    grossPay: Number(payload.grossPay ?? 0),
    sss: Number(payload.sss ?? 0),
    philHealth: Number(payload.philHealth ?? 0),
    pagIbig: Number(payload.pagIbig ?? 0),
    tax: Number(payload.tax ?? 0),
    loans: Number(payload.loans ?? 0),
    cashAdvance: Number(payload.cashAdvance ?? 0),
    lwop: Number(payload.lwop ?? 0),
    absentsLates: Number(payload.absentsLates ?? 0),
    totalDeductions: Number(payload.totalDeductions ?? 0),
    netPay: Number(payload.netPay ?? 0),
    status: (payload.status as 'pending' | 'approved' | 'paid') ?? 'pending',
    bankGcash: String(payload.bankGcash ?? ''),
    approvedBy: payload.approvedBy as string | undefined,
    approvedDate: payload.approvedDate as string | undefined,
    paidDate: payload.paidDate as string | undefined,
  } as TPayroll;
};

const mergeOptimisticPayroll = <TPayroll extends PayrollRecord>(
  current: TPayroll,
  updates: Record<string, unknown>
): TPayroll => {
  return {
    ...current,
    employee: String(updates.employeeName ?? current.employee),
    employeeId: updates.employeeId
      ? String(updates.employeeId)
      : current.employeeId,
    payPeriod: String(updates.payPeriod ?? current.payPeriod),
    basicSalary:
      updates.basicSalary !== undefined
        ? Number(updates.basicSalary)
        : current.basicSalary,
    allowance:
      updates.allowance !== undefined
        ? Number(updates.allowance)
        : current.allowance,
    overtime:
      updates.overtime !== undefined
        ? Number(updates.overtime)
        : current.overtime,
    bonuses:
      updates.bonuses !== undefined ? Number(updates.bonuses) : current.bonuses,
    thirteenthMonth:
      updates.thirteenthMonth !== undefined
        ? Number(updates.thirteenthMonth)
        : current.thirteenthMonth,
    grossPay:
      updates.grossPay !== undefined
        ? Number(updates.grossPay)
        : current.grossPay,
    sss: updates.sss !== undefined ? Number(updates.sss) : current.sss,
    philHealth:
      updates.philHealth !== undefined
        ? Number(updates.philHealth)
        : current.philHealth,
    pagIbig:
      updates.pagIbig !== undefined ? Number(updates.pagIbig) : current.pagIbig,
    tax: updates.tax !== undefined ? Number(updates.tax) : current.tax,
    loans: updates.loans !== undefined ? Number(updates.loans) : current.loans,
    cashAdvance:
      updates.cashAdvance !== undefined
        ? Number(updates.cashAdvance)
        : current.cashAdvance,
    lwop: updates.lwop !== undefined ? Number(updates.lwop) : current.lwop,
    absentsLates:
      updates.absentsLates !== undefined
        ? Number(updates.absentsLates)
        : current.absentsLates,
    totalDeductions:
      updates.totalDeductions !== undefined
        ? Number(updates.totalDeductions)
        : current.totalDeductions,
    netPay:
      updates.netPay !== undefined ? Number(updates.netPay) : current.netPay,
    bankGcash: String(updates.bankGcash ?? current.bankGcash),
    status:
      (updates.status as 'pending' | 'approved' | 'paid') ?? current.status,
    approvedBy:
      (updates.approvedBy as string | undefined) ?? current.approvedBy,
    approvedDate:
      (updates.approvedDate as string | undefined) ?? current.approvedDate,
    paidDate: (updates.paidDate as string | undefined) ?? current.paidDate,
  } as TPayroll;
};

export function usePayrollCrudActions<TPayroll extends PayrollRecord>({
  resolveApiPath,
  getQueryData,
  setQueryData,
  invalidateQuery,
  cancelQuery,
  editingPayroll,
  setEditingPayroll,
  setIsFormOpen,
  calculateTotals,
  resolveEmployeeRecord,
}: UsePayrollCrudActionsOptions<TPayroll>) {
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${resolveApiPath('/payroll')}?id=${id}`);
      return id;
    },
    onMutate: async (deletedId) => {
      await cancelQuery();

      const previous = getQueryData();

      if (previous) {
        setQueryData((current) =>
          current.filter((item) => item.id !== deletedId)
        );
      }

      return { previous };
    },
    onError: async (error, deletedId, context) => {
      if (context?.previous) {
        setQueryData((current) => context.previous ?? current);
      }
      logger.error('Error deleting payroll:', error);
      const Swal = await getSwal();
      void Swal.fire({
        title: 'Error',
        text: 'Failed to delete payroll record. Please try again.',
        icon: 'error',
        confirmButtonColor: '#d33',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
    },
    onSettled: () => {
      invalidateQuery();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const newPayroll = await api.post<Record<string, unknown>>(
        resolveApiPath('/payroll'),
        payload
      );
      return newPayroll;
    },
    onMutate: async (newPayroll) => {
      await cancelQuery();

      const previous = getQueryData();

      if (previous) {
        setQueryData((current) => [
          createOptimisticPayroll<TPayroll>(newPayroll),
          ...current,
        ]);
      }

      return { previous };
    },
    onError: async (error, variables, context) => {
      if (context?.previous) {
        setQueryData((current) => context.previous ?? current);
      }
      logger.error('Error saving payroll:', error);
      const Swal = await getSwal();
      void Swal.fire({
        title: 'Error',
        text: 'Failed to save payroll record. Please try again.',
        icon: 'error',
        confirmButtonColor: '#d33',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
    },
    onSuccess: () => {
      setIsFormOpen(false);
      setEditingPayroll(null);
    },
    onSettled: () => {
      invalidateQuery();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string } & Record<string, unknown>) => {
      const updated = await api.put<Record<string, unknown>>(
        resolveApiPath('/payroll'),
        payload
      );
      return { id: payload.id, updated };
    },
    onMutate: async ({ id, ...updates }) => {
      await cancelQuery();

      const previous = getQueryData();

      if (previous) {
        setQueryData((current) =>
          current.map((item) =>
            item.id === id ? mergeOptimisticPayroll(item, updates) : item
          )
        );
      }

      return { previous };
    },
    onError: async (error, variables, context) => {
      if (context?.previous) {
        setQueryData((current) => context.previous ?? current);
      }
      logger.error('Error updating payroll:', error);
      const Swal = await getSwal();
      void Swal.fire({
        title: 'Error',
        text: 'Failed to update payroll record. Please try again.',
        icon: 'error',
        confirmButtonColor: '#d33',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
    },
    onSuccess: () => {
      setIsFormOpen(false);
      setEditingPayroll(null);
    },
    onSettled: () => {
      invalidateQuery();
    },
  });

  const handleDeletePayroll = async (id: string) => {
    const Swal = await getSwal();
    const result = await Swal.fire({
      title: 'Delete Payroll Record?',
      text: 'This will permanently remove the payroll entry. Continue?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (result.isConfirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleSavePayroll = async (formData: PayrollFormLike) => {
    const totals = calculateTotals(formData);
    const employeeRecord = resolveEmployeeRecord(formData.employee);
    const employeeId =
      employeeRecord?.employeeId ?? editingPayroll?.employeeId ?? null;
    const employeeName = employeeRecord?.name ?? formData.employee;

    const payload = {
      employeeId,
      employeeName,
      payPeriod: formData.payPeriod,
      basicSalary: parseFloat(formData.basicSalary),
      allowance: parseFloat(formData.allowance) || 0,
      overtime: parseFloat(formData.overtime) || 0,
      bonuses: parseFloat(formData.bonuses) || 0,
      thirteenthMonth: parseFloat(formData.thirteenthMonth) || 0,
      sss: parseFloat(formData.sss) || 0,
      philHealth: parseFloat(formData.philHealth) || 0,
      pagIbig: parseFloat(formData.pagIbig) || 0,
      tax: parseFloat(formData.tax) || 0,
      loans: parseFloat(formData.loans) || 0,
      cashAdvance: parseFloat(formData.cashAdvance) || 0,
      lwop: parseFloat(formData.lwop) || 0,
      absentsLates: parseFloat(formData.absentsLates) || 0,
      bankGcash: formData.bankGcash,
      grossPay: totals.grossPay,
      totalDeductions: totals.totalDeductions,
      netPay: totals.netPay,
    };

    if (editingPayroll) {
      updateMutation.mutate({ id: editingPayroll.id, ...payload });
    } else {
      createMutation.mutate({
        ...payload,
        periodStart: formData.payPeriod.split(' to ')[0],
        periodEnd: formData.payPeriod.split(' to ')[1],
        status: 'pending',
      });
    }
  };

  const handleApprove = (id: string) => {
    updateMutation.mutate({
      id,
      status: 'approved',
      approvedBy: 'Current User',
      approvedDate: getCurrentDateISO(),
    });
  };

  return {
    updateMutation,
    handleDeletePayroll,
    handleSavePayroll,
    handleApprove,
  };
}

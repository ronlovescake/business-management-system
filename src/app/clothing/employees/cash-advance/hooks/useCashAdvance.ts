import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryKeys';
import { showError, showDeleteConfirm } from '@/lib/alerts';
import type {
  CashAdvance,
  CashAdvanceCycle,
  CashAdvanceFormData,
  CashAdvanceStatus,
} from '../types';
import { getCurrentDateISO, formatDisplayDate } from '@/utils/date';
import { FormatterService } from '@/services/FormatterService';

export interface EmployeeOption {
  value: string;
  label: string;
}

export const calculateMonthlyPayment = (amount: number, terms: number) => {
  if (terms <= 0) {
    return undefined;
  }
  const payment = amount / terms;
  if (!Number.isFinite(payment) || payment <= 0) {
    return undefined;
  }
  return Number(payment.toFixed(2));
};

interface CashAdvanceApiRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  termsMonths: number | null;
  monthlyPayment: number | null;
  settledAmount: number | null;
  remainingBalance: number | null;
  purpose: string | null;
  notes: string | null;
  requestDate: string | null;
  status: CashAdvanceStatus;
  approvedBy: string | null;
  approvedDate: string | null;
  rejectedBy: string | null;
  rejectedDate: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  deductionCycle: CashAdvanceCycle | null;
  nextDeductionDate: string | null;
  lastDeductedDate: string | null;
}

const sortByCreatedAtDesc = (records: CashAdvance[]) =>
  [...records].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

const mapApiRecordToCashAdvance = (
  record: CashAdvanceApiRecord
): CashAdvance => {
  const termsMonths = record.termsMonths;
  const employeeId = String(record.employeeId ?? '').trim();
  const employeeName = (record.employeeName ?? '').trim();

  return {
    id: record.id,
    employeeId,
    employee: employeeName || employeeId,
    amount: Number(record.amount ?? 0),
    purpose: record.purpose ?? '',
    terms:
      termsMonths !== null && termsMonths !== undefined
        ? String(termsMonths)
        : '',
    termsMonths,
    requestDate: record.requestDate ?? '',
    status: record.status,
    notes: record.notes ?? '',
    approvedBy: record.approvedBy ?? undefined,
    approvedDate: record.approvedDate ?? undefined,
    rejectedBy: record.rejectedBy ?? undefined,
    rejectedDate: record.rejectedDate ?? undefined,
    rejectionReason: record.rejectionReason ?? undefined,
    monthlyPayment:
      record.monthlyPayment !== null && record.monthlyPayment !== undefined
        ? Number(record.monthlyPayment)
        : undefined,
    remainingBalance:
      record.remainingBalance !== null && record.remainingBalance !== undefined
        ? Number(record.remainingBalance)
        : undefined,
    settledAmount:
      record.settledAmount !== null && record.settledAmount !== undefined
        ? Number(record.settledAmount)
        : undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deductionCycle: record.deductionCycle ?? undefined,
    nextDeductionDate: record.nextDeductionDate,
    lastDeductedDate: record.lastDeductedDate,
  };
};

const getSettledAmountFromRecord = (record: CashAdvance) => {
  if (typeof record.settledAmount === 'number') {
    return Math.max(record.settledAmount, 0);
  }

  const remaining =
    typeof record.remainingBalance === 'number'
      ? record.remainingBalance
      : record.amount;

  return Math.max(record.amount - remaining, 0);
};

const getRemainingBalanceFromRecord = (record: CashAdvance) => {
  if (typeof record.remainingBalance === 'number') {
    return Math.max(record.remainingBalance, 0);
  }

  const settled = getSettledAmountFromRecord(record);
  return Math.max(record.amount - settled, 0);
};

export function useCashAdvance() {
  const queryClient = useQueryClient();

  // State Management
  const autoMarkingRef = useRef<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CashAdvance | null>(
    null
  );
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  // Filters for cache key
  const filters = useMemo(
    () => ({ search: searchQuery, status: statusFilter }),
    [searchQuery, statusFilter]
  );

  // Fetch cash advances with React Query
  const {
    data: cashAdvances = [],
    isLoading: isLoadingRequests,
    error,
  } = useQuery({
    queryKey: queryKeys.cashAdvances.list(filters),
    queryFn: async () => {
      const data = await api.get<CashAdvanceApiRecord[]>('/api/cash-advances');

      if (!Array.isArray(data)) {
        throw new Error('Cash advance response was not an array');
      }

      const mapped = data
        .filter(
          (record): record is CashAdvanceApiRecord =>
            record && typeof record === 'object' && 'id' in record
        )
        .map(mapApiRecordToCashAdvance);

      return sortByCreatedAtDesc(mapped);
    },
    staleTime: 30 * 1000,
  });

  // Log errors
  if (error) {
    logger.error('Error loading cash advances:', error);
  }

  const resolveEmployeeName = (employeeId: string) => {
    const normalizedId = employeeId.trim();
    if (!normalizedId) {
      return '';
    }
    const match = employeeOptions.find(
      (option) => option.value === normalizedId
    );
    return match?.label || normalizedId;
  };

  // Computed Values
  const filteredRequests = useMemo(() => {
    return cashAdvances.filter((request) => {
      const matchesSearch =
        request.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.terms.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [cashAdvances, searchQuery, statusFilter]);

  const totalRequests = cashAdvances.length;
  const pendingRequests = cashAdvances.filter(
    (r) => r.status === 'pending'
  ).length;
  const approvedRequests = cashAdvances.filter(
    (r) => r.status === 'approved'
  ).length;
  const totalAmount = cashAdvances
    .filter((r) => r.status === 'approved' || r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);

  // Fetch employees for dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const data = await api.get<
          Array<{
            employeeId?: string;
            name?: string;
            firstName?: string;
            lastName?: string;
          }>
        >('/api/employees');

        if (!Array.isArray(data)) {
          setEmployeeOptions([]);
          return;
        }

        const seen = new Set<string>();
        const options: EmployeeOption[] = [];

        data.forEach((employee) => {
          const employeeId = String(employee?.employeeId ?? '').trim();
          if (!employeeId || seen.has(employeeId)) {
            return;
          }

          const directName = String(employee?.name ?? '').trim();
          const composedName =
            `${String(employee?.firstName ?? '').trim()} ${String(
              employee?.lastName ?? ''
            ).trim()}`
              .replace(/\s+/g, ' ')
              .trim();
          const label = (directName || composedName || employeeId)
            .replace(/\s+/g, ' ')
            .trim();

          options.push({ value: employeeId, label });
          seen.add(employeeId);
        });

        options.sort((a, b) => a.label.localeCompare(b.label));
        setEmployeeOptions(options);
      } catch (error) {
        logger.error('Error fetching employees for cash advances:', error);
        setEmployeeOptions([]);
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/cash-advances?id=${id}`);
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.cashAdvances.lists(),
      });

      const previous = queryClient.getQueryData<CashAdvance[]>(
        queryKeys.cashAdvances.list(filters)
      );

      if (previous) {
        queryClient.setQueryData<CashAdvance[]>(
          queryKeys.cashAdvances.list(filters),
          previous.filter((r) => r.id !== deletedId)
        );
      }

      return { previous };
    },
    onError: (error, deletedId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.cashAdvances.list(filters),
          context.previous
        );
      }
      logger.error('Error deleting cash advance request:', error);
      void showError(
        'Failed to delete cash advance request. Please try again.',
        'Delete Failed'
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cashAdvances.lists(),
      });
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      isUpdate,
      payload,
    }: {
      isUpdate: boolean;
      payload: Record<string, unknown>;
    }) => {
      if (isUpdate) {
        const updated = await api.put<CashAdvanceApiRecord>(
          '/api/cash-advances',
          payload
        );
        return mapApiRecordToCashAdvance(updated);
      } else {
        const created = await api.post<CashAdvanceApiRecord>(
          '/api/cash-advances',
          payload
        );
        return mapApiRecordToCashAdvance(created);
      }
    },
    onMutate: async ({ isUpdate, payload }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.cashAdvances.lists(),
      });

      const previous = queryClient.getQueryData<CashAdvance[]>(
        queryKeys.cashAdvances.list(filters)
      );

      if (previous) {
        if (isUpdate && payload.id) {
          // Optimistic update
          queryClient.setQueryData<CashAdvance[]>(
            queryKeys.cashAdvances.list(filters),
            previous.map((r) =>
              r.id === payload.id
                ? { ...r, ...payload, updatedAt: new Date().toISOString() }
                : r
            )
          );
        } else {
          // Optimistic add
          const tempRecord: CashAdvance = {
            id: 'temp-' + Date.now(),
            employeeId: String(payload.employeeId ?? ''),
            employee: String(payload.employeeName ?? payload.employeeId ?? ''),
            amount: Number(payload.amount ?? 0),
            purpose: String(payload.purpose ?? ''),
            terms: payload.termsMonths ? String(payload.termsMonths) : '',
            termsMonths: payload.termsMonths as number | null,
            requestDate: String(payload.requestDate ?? ''),
            status: 'pending',
            notes: String(payload.notes ?? ''),
            monthlyPayment: payload.monthlyPayment as number | undefined,
            settledAmount: 0,
            remainingBalance: Number(payload.amount ?? 0),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          queryClient.setQueryData<CashAdvance[]>(
            queryKeys.cashAdvances.list(filters),
            [tempRecord, ...previous]
          );
        }
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.cashAdvances.list(filters),
          context.previous
        );
      }
      logger.error('Error saving cash advance request:', error);
      void showError(
        'Failed to save cash advance request. Please try again.',
        'Save Failed'
      );
    },
    onSuccess: () => {
      setIsFormOpen(false);
      setEditingRequest(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cashAdvances.lists(),
      });
    },
  });

  // Update status mutation (approve/reject/mark paid)
  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { id: string } & Record<string, unknown>) => {
      const updated = await api.put<CashAdvanceApiRecord>(
        '/api/cash-advances',
        payload
      );
      return mapApiRecordToCashAdvance(updated);
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.cashAdvances.lists(),
      });

      const previous = queryClient.getQueryData<CashAdvance[]>(
        queryKeys.cashAdvances.list(filters)
      );

      if (previous) {
        queryClient.setQueryData<CashAdvance[]>(
          queryKeys.cashAdvances.list(filters),
          previous.map((r) =>
            r.id === id
              ? { ...r, ...updates, updatedAt: new Date().toISOString() }
              : r
          )
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.cashAdvances.list(filters),
          context.previous
        );
      }
      logger.error('Error updating cash advance:', error);
      void showError(
        'Failed to update cash advance. Please try again.',
        'Update Failed'
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cashAdvances.lists(),
      });
    },
  });

  // Utility Functions
  const formatDate = (dateString: string) =>
    formatDisplayDate(dateString, 'MMM D, YYYY');

  const formatCurrency = (amount: number) =>
    FormatterService.formatCurrency(amount);

  const getStatusColor = (status: CashAdvance['status']) => {
    switch (status) {
      case 'pending':
        return 'yellow';
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      case 'paid':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Event Handlers
  const handleAddRequest = () => {
    setEditingRequest(null);
    setIsFormOpen(true);
  };

  const handleEditRequest = (request: CashAdvance) => {
    setEditingRequest(request);
    setIsFormOpen(true);
  };

  const handleDeleteRequest = async (id: string) => {
    const confirmed = await showDeleteConfirm('this cash advance request');
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleSaveRequest = async (
    formData: CashAdvanceFormData
  ): Promise<boolean> => {
    const employeeId = formData.employee.trim();
    const employeeName = resolveEmployeeName(employeeId);

    if (!employeeId) {
      await showError(
        'Employee is required. Please select a valid employee.',
        'Validation Error'
      );
      return false;
    }

    const parsedAmount = Number.parseFloat(formData.amount);
    const parsedTerms = Number.parseInt(formData.terms, 10);
    const monthlyPayment = calculateMonthlyPayment(
      parsedAmount,
      Number.isNaN(parsedTerms) ? 0 : parsedTerms
    );

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      await showError(
        'Amount must be a valid number greater than zero.',
        'Validation Error'
      );
      return false;
    }

    const payloadBase = {
      employeeId,
      employeeName: employeeName || employeeId,
      amount: parsedAmount,
      termsMonths: Number.isNaN(parsedTerms) ? null : parsedTerms,
      monthlyPayment: monthlyPayment ?? null,
      purpose: formData.purpose.trim() || null,
      notes: formData.notes?.trim() || null,
      requestDate: formData.requestDate || null,
    };

    try {
      if (editingRequest) {
        const existingSettled = getSettledAmountFromRecord(editingRequest);

        saveMutation.mutate({
          isUpdate: true,
          payload: {
            id: editingRequest.id,
            status: editingRequest.status,
            settledAmount: existingSettled,
            remainingBalance: Math.max(parsedAmount - existingSettled, 0),
            ...payloadBase,
          },
        });
      } else {
        saveMutation.mutate({
          isUpdate: false,
          payload: {
            status: 'pending',
            settledAmount: 0,
            remainingBalance: parsedAmount,
            ...payloadBase,
          },
        });
      }

      return true;
    } catch (error) {
      logger.error('Error in handleSaveRequest:', error);
      return false;
    }
  };

  const handleApprove = (id: string) => {
    updateStatusMutation.mutate({
      id,
      status: 'approved',
      approvedBy: 'Current User',
      approvedDate: new Date().toISOString(),
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
    });
  };

  const handleReject = (id: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason) {
      updateStatusMutation.mutate({
        id,
        status: 'rejected',
        rejectedBy: 'Current User',
        rejectedDate: new Date().toISOString(),
        rejectionReason: reason,
        approvedBy: null,
        approvedDate: null,
      });
    }
  };

  // Auto-mark as paid when balance reaches zero
  useEffect(() => {
    cashAdvances.forEach((record) => {
      if (record.status !== 'approved') {
        return;
      }

      const remaining = getRemainingBalanceFromRecord(record);
      if (remaining > 0.01) {
        return;
      }

      if (autoMarkingRef.current.has(record.id)) {
        return;
      }

      autoMarkingRef.current.add(record.id);
      updateStatusMutation.mutate({
        id: record.id,
        status: 'paid',
        settledAmount: record.amount,
        remainingBalance: 0,
      });
    });
  }, [cashAdvances, updateStatusMutation]);

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').slice(1); // Skip header row

      const imported = rows
        .filter((row) => row.trim())
        .map((row) => {
          const [employee, amount, purpose, terms, requestDate, status] =
            row.split(',');
          const trimmedEmployee = employee?.trim() || '';
          const parsedAmount = Number.parseFloat(amount?.trim() || '0');
          const parsedTerms = Number.parseInt(terms?.trim() || '', 10);
          const monthlyPayment = calculateMonthlyPayment(
            parsedAmount,
            Number.isNaN(parsedTerms) ? 0 : parsedTerms
          );

          return {
            employeeId: trimmedEmployee,
            employeeName: trimmedEmployee,
            amount: parsedAmount,
            purpose: purpose?.trim() || '',
            termsMonths: Number.isNaN(parsedTerms) ? null : parsedTerms,
            requestDate: requestDate?.trim() || '',
            status: (status?.trim() || 'pending') as CashAdvanceStatus,
            notes: '',
            monthlyPayment: monthlyPayment ?? null,
            settledAmount: 0,
            remainingBalance: parsedAmount,
          };
        });

      // Bulk create via API
      try {
        for (const record of imported) {
          await api.post('/api/cash-advances', record);
        }

        // Invalidate to refetch
        queryClient.invalidateQueries({
          queryKey: queryKeys.cashAdvances.lists(),
        });
      } catch (error) {
        logger.error('Error importing cash advances:', error);
        void showError(
          'Failed to import some cash advances. Please try again.',
          'Import Failed'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee',
      'Amount',
      'Purpose',
      'Terms',
      'Request Date',
      'Status',
    ];
    const rows = filteredRequests.map((r) => [
      r.employee,
      r.amount.toString(),
      r.purpose,
      r.terms,
      r.requestDate,
      r.status,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-advances-${getCurrentDateISO()}.csv`;
    a.click();
  };

  return {
    // State
    cashAdvances: filteredRequests,
    searchQuery,
    statusFilter,
    isFormOpen,
    editingRequest,
    isLoadingRequests,

    // Computed Values
    totalRequests,
    pendingRequests,
    approvedRequests,
    totalAmount,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setIsFormOpen,

    // Utility Functions
    formatDate,
    formatCurrency,
    getStatusColor,

    // Event Handlers
    handleAddRequest,
    handleEditRequest,
    handleDeleteRequest,
    handleSaveRequest,
    handleApprove,
    handleReject,
    handleImportCSV,
    handleExportCSV,

    // Employees
    employeeOptions,
    isLoadingEmployees,
  };
}

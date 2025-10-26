import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
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
  // State Management
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const autoMarkingRef = useRef<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CashAdvance | null>(
    null
  );
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  const applyUpsert = useCallback((record: CashAdvance) => {
    setCashAdvances((prev) => {
      const exists = prev.some((item) => item.id === record.id);
      const next = exists
        ? prev.map((item) => (item.id === record.id ? record : item))
        : [record, ...prev];
      return sortByCreatedAtDesc(next);
    });
  }, []);

  const applyRemoval = useCallback((id: string) => {
    setCashAdvances((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const fetchCashAdvances = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
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

      setCashAdvances(sortByCreatedAtDesc(mapped));
    } catch (error) {
      logger.error('Error loading cash advances:', error);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

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

  useEffect(() => {
    void fetchCashAdvances();
  }, [fetchCashAdvances]);

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

  const handleDeleteRequest = (id: string) => {
    if (confirm('Are you sure you want to delete this cash advance request?')) {
      void (async () => {
        try {
          await api.delete(`/api/cash-advances?id=${id}`);

          applyRemoval(id);
        } catch (error) {
          logger.error('Error deleting cash advance request:', error);
          alert('Failed to delete cash advance request. Please try again.');
        }
      })();
    }
  };

  const handleSaveRequest = async (
    formData: CashAdvanceFormData
  ): Promise<boolean> => {
    const employeeId = formData.employee.trim();
    const employeeName = resolveEmployeeName(employeeId);

    if (!employeeId) {
      alert('Employee is required. Please select a valid employee.');
      return false;
    }

    const parsedAmount = Number.parseFloat(formData.amount);
    const parsedTerms = Number.parseInt(formData.terms, 10);
    const monthlyPayment = calculateMonthlyPayment(
      parsedAmount,
      Number.isNaN(parsedTerms) ? 0 : parsedTerms
    );

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Amount must be a valid number greater than zero.');
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
        const existingSettled = editingRequest
          ? getSettledAmountFromRecord(editingRequest)
          : 0;

        const updated = await api.put<CashAdvanceApiRecord>(
          '/api/cash-advances',
          {
            id: editingRequest.id,
            status: editingRequest.status,
            settledAmount: existingSettled,
            remainingBalance: Math.max(parsedAmount - existingSettled, 0),
            ...payloadBase,
          }
        );

        applyUpsert(mapApiRecordToCashAdvance(updated));
      } else {
        const created = await api.post<CashAdvanceApiRecord>(
          '/api/cash-advances',
          {
            status: 'pending',
            settledAmount: 0,
            remainingBalance: parsedAmount,
            ...payloadBase,
          }
        );

        applyUpsert(mapApiRecordToCashAdvance(created));
      }

      setIsFormOpen(false);
      setEditingRequest(null);
      return true;
    } catch (error) {
      logger.error('Error saving cash advance request:', error);
      alert('Failed to save cash advance request. Please try again.');
      return false;
    }
  };

  const mutateCashAdvance = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      const payload = await api.put<CashAdvanceApiRecord>(
        '/api/cash-advances',
        {
          id,
          ...data,
        }
      );

      const mapped = mapApiRecordToCashAdvance(payload);
      applyUpsert(mapped);
      return mapped;
    },
    [applyUpsert]
  );

  const handleApprove = (id: string) => {
    void (async () => {
      try {
        await mutateCashAdvance(id, {
          status: 'approved',
          approvedBy: 'Current User',
          approvedDate: new Date().toISOString(),
          rejectedBy: null,
          rejectedDate: null,
          rejectionReason: null,
        });
      } catch (error) {
        logger.error('Error approving cash advance:', error);
        alert('Failed to approve cash advance. Please try again.');
      }
    })();
  };

  const handleReject = (id: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason) {
      void (async () => {
        try {
          await mutateCashAdvance(id, {
            status: 'rejected',
            rejectedBy: 'Current User',
            rejectedDate: new Date().toISOString(),
            rejectionReason: reason,
            approvedBy: null,
            approvedDate: null,
          });
        } catch (error) {
          logger.error('Error rejecting cash advance:', error);
          alert('Failed to reject cash advance. Please try again.');
        }
      })();
    }
  };

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
      void mutateCashAdvance(record.id, {
        status: 'paid',
        settledAmount: record.amount,
        remainingBalance: 0,
      }).catch((error) => {
        logger.error('Error auto-marking cash advance as paid:', error);
        autoMarkingRef.current.delete(record.id);
      });
    });
  }, [cashAdvances, mutateCashAdvance]);

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
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
          const timestamp = new Date().toISOString();

          return {
            id: Date.now().toString() + Math.random(),
            employeeId: trimmedEmployee,
            employee: trimmedEmployee,
            amount: parsedAmount,
            purpose: purpose?.trim() || '',
            terms: terms?.trim() || '',
            termsMonths: Number.isNaN(parsedTerms) ? null : parsedTerms,
            requestDate: requestDate?.trim() || '',
            status: (status?.trim() || 'pending') as CashAdvance['status'],
            notes: '',
            monthlyPayment: monthlyPayment ?? undefined,
            settledAmount: 0,
            remainingBalance: parsedAmount,
            createdAt: timestamp,
            updatedAt: timestamp,
          } as CashAdvance;
        });

      imported.forEach((record) => applyUpsert(record));
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

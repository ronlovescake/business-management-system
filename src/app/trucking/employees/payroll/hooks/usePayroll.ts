import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryKeys';
import { usePayrollBase } from '@/hooks/usePayrollBase';
import {
  formatPayrollCurrency,
  formatPayrollDate,
  getPayrollStatusColor,
} from '@/lib/payroll/formatters';
import type { Payroll, PayrollFormData } from '../types';
import { getCurrentDateISO } from '@/utils/date';
import Swal from 'sweetalert2';

export function usePayroll() {
  const queryClient = useQueryClient();

  const resolveApiPath = useCallback(
    (path: string) => `/api/trucking${path}`,
    []
  );

  const createPayrollQueryKey = useCallback(
    (filters: { search: string; status: string; period: string }) =>
      queryKeys.payroll.list(filters),
    []
  );

  // State Management
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);
  const [isGeneratingPayslips, setIsGeneratingPayslips] = useState(false);
  const [isSyncingLwop, setIsSyncingLwop] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkPaying, setIsBulkPaying] = useState(false);

  const {
    employeeOptions,
    resolveEmployeeRecord,
    payrollQueryKey,
    payrolls,
    filteredPayrolls,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    payPeriodFilter,
    setPayPeriodFilter,
  } = usePayrollBase({
    resolveApiPath,
    createPayrollQueryKey,
  });

  // Computed Values
  const totalPayrolls = payrolls.length;
  const pendingPayrolls = payrolls.filter((p) => p.status === 'pending').length;
  const approvedPayrolls = payrolls.filter(
    (p) => p.status === 'approved'
  ).length;
  const totalNetPay = payrolls
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.netPay, 0);

  // Get unique pay periods for filter
  const payPeriods = useMemo(() => {
    const periods = Array.from(new Set(payrolls.map((p) => p.payPeriod)));
    return ['all', ...periods];
  }, [payrolls]);

  const payPeriodOptions = useMemo(
    () => payPeriods.filter((period) => period && period !== 'all'),
    [payPeriods]
  );

  // Utility Functions
  const formatDate = formatPayrollDate;
  const formatCurrency = formatPayrollCurrency;
  const getStatusColor = getPayrollStatusColor;

  const parsePayPeriodLabel = useCallback((label: string) => {
    if (!label) {
      return null;
    }

    const separator = label.includes(' to ')
      ? ' to '
      : label.includes(' - ')
        ? ' - '
        : null;

    if (!separator) {
      return null;
    }

    const [startRaw, endRaw] = label.split(separator);
    const start = startRaw?.trim();
    const end = endRaw?.trim();

    if (!start || !end) {
      return null;
    }

    return { start, end };
  }, []);

  // Calculate totals from form data
  const calculateTotals = (formData: PayrollFormData) => {
    const basicSalary = parseFloat(formData.basicSalary) || 0;
    const allowance = parseFloat(formData.allowance) || 0;
    const overtime = parseFloat(formData.overtime) || 0;
    const bonuses = parseFloat(formData.bonuses) || 0;
    const thirteenthMonth = parseFloat(formData.thirteenthMonth) || 0;
    const sss = parseFloat(formData.sss) || 0;
    const philHealth = parseFloat(formData.philHealth) || 0;
    const pagIbig = parseFloat(formData.pagIbig) || 0;
    const tax = parseFloat(formData.tax) || 0;
    const loans = parseFloat(formData.loans) || 0;
    const cashAdvance = parseFloat(formData.cashAdvance) || 0;
    const lwop = parseFloat(formData.lwop) || 0;
    const absentsLates = parseFloat(formData.absentsLates) || 0;

    const grossPay =
      basicSalary + allowance + overtime + bonuses + thirteenthMonth;
    const totalDeductions =
      sss +
      philHealth +
      pagIbig +
      tax +
      loans +
      cashAdvance +
      lwop +
      absentsLates;
    const netPay = grossPay - totalDeductions;

    return {
      grossPay,
      totalDeductions,
      netPay: Math.max(0, netPay), // Ensure net pay is not negative
    };
  };

  const generatePayslipsForPeriod = useCallback(
    async ({
      periodStart,
      periodEnd,
      payPeriodLabel,
    }: {
      periodStart: string;
      periodEnd: string;
      payPeriodLabel: string;
    }) => {
      if (!periodStart || !periodEnd) {
        return {
          success: false,
          error: 'Missing pay period details for payslip generation.',
        } as const;
      }

      if (isGeneratingPayslips) {
        return {
          success: false,
          error: 'Payslip generation is already in progress.',
        } as const;
      }

      setIsGeneratingPayslips(true);

      try {
        const response = await fetch(
          '/api/trucking/payroll/generate-payslips',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              periodStart,
              periodEnd,
              payPeriodLabel,
            }),
          }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          const message = errorData?.error || 'Failed to generate payslips.';
          return {
            success: false,
            error: message,
          } as const;
        }

        if (typeof window === 'undefined') {
          return {
            success: false,
            error: 'Payslip download is only available in the browser.',
          } as const;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const contentDisposition = response.headers.get('Content-Disposition');

        let filename = `payslips-${periodEnd.replace(/[^0-9]/g, '') || 'export'}.zip`;

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(
            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
          );
          if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(
              filenameMatch[1].replace(/['"]/g, '')
            );
          }
        }

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        return {
          success: true,
        } as const;
      } catch (error) {
        logger.error('Error generating payslips:', error);
        return {
          success: false,
          error:
            error instanceof Error && error.message
              ? error.message
              : 'Failed to download payslips. Please try again.',
        } as const;
      } finally {
        setIsGeneratingPayslips(false);
      }
    },
    [isGeneratingPayslips]
  );

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/trucking/payroll?id=${id}`);
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.payroll.lists() });

      const previous = queryClient.getQueryData<Payroll[]>(payrollQueryKey);

      if (previous) {
        queryClient.setQueryData<Payroll[]>(
          payrollQueryKey,
          previous.filter((p) => p.id !== deletedId)
        );
      }

      return { previous };
    },
    onError: (error, deletedId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(payrollQueryKey, context.previous);
      }
      logger.error('Error deleting payroll:', error);
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
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.lists() });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const newPayroll = await api.post<Record<string, unknown>>(
        '/api/trucking/payroll',
        payload
      );
      return newPayroll;
    },
    onMutate: async (newPayroll) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.payroll.lists() });

      const previous = queryClient.getQueryData<Payroll[]>(payrollQueryKey);

      if (previous) {
        const tempPayroll = {
          id: 'temp-' + Date.now(),
          employee: String(newPayroll.employeeName ?? ''),
          employeeId: newPayroll.employeeId
            ? String(newPayroll.employeeId)
            : null,
          payPeriod: String(newPayroll.payPeriod ?? ''),
          basicSalary: Number(newPayroll.basicSalary ?? 0),
          allowance: Number(newPayroll.allowance ?? 0),
          overtime: Number(newPayroll.overtime ?? 0),
          bonuses: Number(newPayroll.bonuses ?? 0),
          thirteenthMonth: Number(newPayroll.thirteenthMonth ?? 0),
          grossPay: Number(newPayroll.grossPay ?? 0),
          sss: Number(newPayroll.sss ?? 0),
          philHealth: Number(newPayroll.philHealth ?? 0),
          pagIbig: Number(newPayroll.pagIbig ?? 0),
          tax: Number(newPayroll.tax ?? 0),
          loans: Number(newPayroll.loans ?? 0),
          cashAdvance: Number(newPayroll.cashAdvance ?? 0),
          lwop: Number(newPayroll.lwop ?? 0),
          absentsLates: Number(newPayroll.absentsLates ?? 0),
          totalDeductions: Number(newPayroll.totalDeductions ?? 0),
          netPay: Number(newPayroll.netPay ?? 0),
          status: newPayroll.status as 'pending' | 'approved' | 'paid',
          bankGcash: String(newPayroll.bankGcash ?? ''),
        } as Payroll;

        queryClient.setQueryData<Payroll[]>(payrollQueryKey, [
          tempPayroll,
          ...previous,
        ]);
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(payrollQueryKey, context.previous);
      }
      logger.error('Error saving payroll:', error);
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
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.lists() });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string } & Record<string, unknown>) => {
      const updated = await api.put<Record<string, unknown>>(
        '/api/trucking/payroll',
        payload
      );
      return { id: payload.id, updated };
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.payroll.lists() });

      const previous = queryClient.getQueryData<Payroll[]>(payrollQueryKey);

      if (previous) {
        queryClient.setQueryData<Payroll[]>(
          payrollQueryKey,
          previous.map((p) =>
            p.id === id
              ? {
                  ...p,
                  employee: String(updates.employeeName ?? p.employee),
                  employeeId: updates.employeeId
                    ? String(updates.employeeId)
                    : p.employeeId,
                  payPeriod: String(updates.payPeriod ?? p.payPeriod),
                  basicSalary:
                    updates.basicSalary !== undefined
                      ? Number(updates.basicSalary)
                      : p.basicSalary,
                  allowance:
                    updates.allowance !== undefined
                      ? Number(updates.allowance)
                      : p.allowance,
                  overtime:
                    updates.overtime !== undefined
                      ? Number(updates.overtime)
                      : p.overtime,
                  bonuses:
                    updates.bonuses !== undefined
                      ? Number(updates.bonuses)
                      : p.bonuses,
                  thirteenthMonth:
                    updates.thirteenthMonth !== undefined
                      ? Number(updates.thirteenthMonth)
                      : p.thirteenthMonth,
                  grossPay:
                    updates.grossPay !== undefined
                      ? Number(updates.grossPay)
                      : p.grossPay,
                  sss: updates.sss !== undefined ? Number(updates.sss) : p.sss,
                  philHealth:
                    updates.philHealth !== undefined
                      ? Number(updates.philHealth)
                      : p.philHealth,
                  pagIbig:
                    updates.pagIbig !== undefined
                      ? Number(updates.pagIbig)
                      : p.pagIbig,
                  tax: updates.tax !== undefined ? Number(updates.tax) : p.tax,
                  loans:
                    updates.loans !== undefined
                      ? Number(updates.loans)
                      : p.loans,
                  cashAdvance:
                    updates.cashAdvance !== undefined
                      ? Number(updates.cashAdvance)
                      : p.cashAdvance,
                  lwop:
                    updates.lwop !== undefined ? Number(updates.lwop) : p.lwop,
                  absentsLates:
                    updates.absentsLates !== undefined
                      ? Number(updates.absentsLates)
                      : p.absentsLates,
                  totalDeductions:
                    updates.totalDeductions !== undefined
                      ? Number(updates.totalDeductions)
                      : p.totalDeductions,
                  netPay:
                    updates.netPay !== undefined
                      ? Number(updates.netPay)
                      : p.netPay,
                  bankGcash: String(updates.bankGcash ?? p.bankGcash),
                  status:
                    (updates.status as 'pending' | 'approved' | 'paid') ??
                    p.status,
                  approvedBy:
                    (updates.approvedBy as string | undefined) ?? p.approvedBy,
                  approvedDate:
                    (updates.approvedDate as string | undefined) ??
                    p.approvedDate,
                  paidDate:
                    (updates.paidDate as string | undefined) ?? p.paidDate,
                }
              : p
          )
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(payrollQueryKey, context.previous);
      }
      logger.error('Error updating payroll:', error);
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
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.lists() });
    },
  });

  // Event Handlers
  const handleAddPayroll = async () => {
    if (isGeneratingPayroll) {
      return;
    }

    const parseISODate = (value: string) => {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const formatLocalISO = (date: Date) => {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getCurrentPayPeriod = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();

      const startDate =
        day <= 15 ? new Date(year, month, 1) : new Date(year, month, 16);
      const endDate =
        day <= 15 ? new Date(year, month, 15) : new Date(year, month + 1, 0);

      const start = formatLocalISO(startDate);
      const end = formatLocalISO(endDate);

      return { start, end, label: `${start} to ${end}` };
    };

    const alignToPeriodStart = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      return day <= 15 ? new Date(year, month, 1) : new Date(year, month, 16);
    };

    const buildExpectedPeriods = (startISO: string, endISO: string) => {
      const periods: { start: string; end: string; label: string }[] = [];
      let cursor = alignToPeriodStart(new Date(startISO));
      const endBoundary = new Date(endISO);

      while (cursor <= endBoundary) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const day = cursor.getDate();
        const periodStart = new Date(cursor);
        const periodEnd =
          day === 1 ? new Date(year, month, 15) : new Date(year, month + 1, 0);

        const start = formatLocalISO(periodStart);
        const end = formatLocalISO(periodEnd);
        periods.push({ start, end, label: `${start} to ${end}` });

        cursor =
          day === 1 ? new Date(year, month, 16) : new Date(year, month + 1, 1);
      }

      return periods;
    };

    const currentPeriod = getCurrentPayPeriod();

    const existingPeriodLabels = new Set<string>();
    let earliestStart: string | null = null;

    const normalizePeriodLabel = (startRaw: string, endRaw: string) => {
      const start = parseISODate(startRaw);
      const end = parseISODate(endRaw);
      if (start && end) {
        const startIso = formatLocalISO(start);
        const endIso = formatLocalISO(end);
        return `${startIso} to ${endIso}`;
      }
      return `${startRaw.trim()} to ${endRaw.trim()}`;
    };

    payrolls.forEach((p) => {
      const parsed = parsePayPeriodLabel(p.payPeriod);
      if (parsed) {
        const normalizedLabel = normalizePeriodLabel(parsed.start, parsed.end);
        existingPeriodLabels.add(normalizedLabel);

        const parsedStart = parseISODate(parsed.start);
        if (parsedStart) {
          const startIso = formatLocalISO(parsedStart);
          if (!earliestStart || parsedStart < new Date(earliestStart)) {
            earliestStart = startIso;
          }
        }
      }
    });

    if (!earliestStart) {
      earliestStart = currentPeriod.start;
    }

    const expectedPeriods = buildExpectedPeriods(
      earliestStart,
      currentPeriod.end
    );
    const missingPeriods = expectedPeriods
      .filter((period) => !existingPeriodLabels.has(period.label))
      .map((period) => ({ value: period.label, label: period.label }));

    const defaultPeriodOption = 'current';

    const payPeriodChoices = [
      { value: 'current', label: 'Current period (based on today)' },
      ...missingPeriods,
      { value: 'custom', label: 'Custom period' },
    ];

    const payPeriodOptionsHtml = payPeriodChoices
      .map(
        (option) =>
          `<option value="${option.value}" ${option.value === defaultPeriodOption ? 'selected' : ''}>${option.label}</option>`
      )
      .join('');

    const modalResult = await Swal.fire({
      title: 'Generate Payroll?',
      width: '44rem',
      padding: '2.25rem 2.5rem 2rem',
      html: `
        <div style="text-align:left; margin-bottom: 12px; color: #4b5563;">
          Select a pay period to generate payroll for. Choose an existing period or enter a custom range if it does not exist yet.
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label style="font-weight:600; color:#111827;">Pay period</label>
          <div style="display:flex; justify-content:center; width:100%;">
            <select
              id="payPeriodSelect"
              class="swal2-select"
              style="width:100%; max-width: 420px;"
            >
              ${payPeriodOptionsHtml}
            </select>
          </div>
          <div id="customPeriodFields" style="display:none; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px; margin-top:8px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-weight:600; color:#111827;">Start date</label>
              <input id="customPeriodStart" type="date" class="swal2-input" style="width:100%;" />
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-weight:600; color:#111827;">End date</label>
              <input id="customPeriodEnd" type="date" class="swal2-input" style="width:100%;" />
            </div>
            <div style="grid-column: span 2; display:flex; flex-direction:column; gap:4px;">
              <label style="font-weight:600; color:#111827;">Optional label</label>
              <input id="customPeriodLabel" type="text" class="swal2-input" placeholder="e.g., 2025-12-01 to 2025-12-15" style="width:100%;" />
            </div>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Generate Payroll',
      cancelButtonText: 'Cancel',
      allowOutsideClick: false,
      focusConfirm: false,
      didOpen: () => {
        const selectEl = document.getElementById(
          'payPeriodSelect'
        ) as HTMLSelectElement | null;
        const customFields = document.getElementById('customPeriodFields');

        const toggleCustomFields = (value: string | undefined) => {
          if (!customFields) {
            return;
          }
          customFields.style.display = value === 'custom' ? 'grid' : 'none';
        };

        toggleCustomFields(selectEl?.value);
        selectEl?.addEventListener('change', (event) => {
          const target = event.target as HTMLSelectElement;
          toggleCustomFields(target.value);
        });
      },
      preConfirm: () => {
        const selectEl = document.getElementById(
          'payPeriodSelect'
        ) as HTMLSelectElement | null;
        const selected = selectEl?.value ?? 'current';

        if (selected === 'current') {
          return {
            periodStart: null,
            periodEnd: null,
            payPeriodLabel: null,
          } as const;
        }

        if (selected === 'custom') {
          const startEl = document.getElementById(
            'customPeriodStart'
          ) as HTMLInputElement | null;
          const endEl = document.getElementById(
            'customPeriodEnd'
          ) as HTMLInputElement | null;
          const labelEl = document.getElementById(
            'customPeriodLabel'
          ) as HTMLInputElement | null;

          const periodStart = startEl?.value || '';
          const periodEnd = endEl?.value || '';
          const payPeriodLabel = (labelEl?.value || '').trim();

          if (!periodStart || !periodEnd) {
            Swal.showValidationMessage(
              'Please provide both start and end dates.'
            );
            return null;
          }

          if (new Date(periodStart) > new Date(periodEnd)) {
            Swal.showValidationMessage('Start date must be before end date.');
            return null;
          }

          return {
            periodStart,
            periodEnd,
            payPeriodLabel: payPeriodLabel || `${periodStart} to ${periodEnd}`,
          } as const;
        }

        const parsed = parsePayPeriodLabel(selected);
        if (!parsed) {
          Swal.showValidationMessage('Please select a valid pay period.');
          return null;
        }

        return {
          periodStart: parsed.start,
          periodEnd: parsed.end,
          payPeriodLabel: selected,
        } as const;
      },
    });

    if (!modalResult.isConfirmed || !modalResult.value) {
      return;
    }

    const { periodStart, periodEnd, payPeriodLabel } = modalResult.value as {
      periodStart: string | null;
      periodEnd: string | null;
      payPeriodLabel: string | null;
    };

    setIsGeneratingPayroll(true);

    try {
      const payload: Record<string, unknown> = {};
      if (periodStart && periodEnd) {
        payload.periodStart = periodStart;
        payload.periodEnd = periodEnd;
      }
      if (payPeriodLabel) {
        payload.payPeriodLabel = payPeriodLabel;
      }

      const result = await api.post<unknown>(
        '/api/trucking/payroll/generate',
        payload
      );

      const normalized =
        typeof result === 'object' && result !== null
          ? (result as Record<string, unknown>)
          : {};

      if (normalized.success === false) {
        const message =
          typeof normalized.message === 'string'
            ? normalized.message
            : typeof normalized.error === 'string'
              ? normalized.error
              : 'Failed to generate payroll for the current period.';

        const action =
          typeof normalized.action === 'string' ? normalized.action : undefined;

        // Check if this is a soft-deleted payroll conflict
        if (
          action === 'restore_or_hard_delete' ||
          action === 'cleanup_soft_deleted'
        ) {
          const cleanupResult = await Swal.fire({
            title: 'Deleted Payroll Found',
            html: `
              <p>${message}</p>
              <p style="margin-top: 15px; color: #666;">
                Would you like to permanently remove the deleted payroll records and generate new ones?
              </p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, clean up and regenerate',
            cancelButtonText: 'Cancel',
            allowOutsideClick: false,
          });

          if (cleanupResult.isConfirmed) {
            // Extract period from response
            const period = normalized.period as
              | { start: string; end: string }
              | undefined;
            if (period?.start && period?.end) {
              // Clean up soft-deleted records
              await api.delete(
                `/api/trucking/payroll/cleanup?periodStart=${period.start}&periodEnd=${period.end}`
              );

              // Try generating again
              const retryResult = await api.post<unknown>(
                '/api/trucking/payroll/generate'
              );
              const retryNormalized =
                typeof retryResult === 'object' && retryResult !== null
                  ? (retryResult as Record<string, unknown>)
                  : {};

              if (retryNormalized.success === false) {
                throw new Error(
                  typeof retryNormalized.message === 'string'
                    ? retryNormalized.message
                    : 'Failed to generate payroll after cleanup.'
                );
              }

              // Success after cleanup
              queryClient.invalidateQueries({
                queryKey: queryKeys.payroll.lists(),
              });
              const count = Number(retryNormalized.count ?? 0);
              const safeCount = Number.isFinite(count) ? count : 0;

              await Swal.fire({
                title: 'Success!',
                text: `Successfully cleaned up deleted records and generated payroll for ${safeCount} employee${safeCount === 1 ? '' : 's'}.`,
                icon: 'success',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'OK',
                allowOutsideClick: false,
              });

              setIsGeneratingPayroll(false);
              return;
            }
          }

          setIsGeneratingPayroll(false);
          return;
        }

        throw new Error(message);
      }

      // Invalidate cache to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.lists() });

      // Success prompt with details
      const count = Number(normalized.count ?? 0);
      const safeCount = Number.isFinite(count) ? count : 0;
      const message =
        typeof normalized.message === 'string' && normalized.message.trim()
          ? normalized.message
          : `Successfully generated payroll for ${safeCount} employee${safeCount === 1 ? '' : 's'}.`;

      let payslipResult: { success: boolean; error?: string } | null = null;
      const periodInfo = (normalized.period ?? null) as {
        start?: string;
        end?: string;
        label?: string;
      } | null;

      if (periodInfo?.start && periodInfo?.end) {
        payslipResult = await generatePayslipsForPeriod({
          periodStart: periodInfo.start,
          periodEnd: periodInfo.end,
          payPeriodLabel:
            typeof periodInfo.label === 'string' && periodInfo.label.trim()
              ? periodInfo.label
              : `${periodInfo.start} to ${periodInfo.end}`,
        });
      }

      const payslipSuccess = payslipResult?.success ?? false;
      const infoMessage = payslipSuccess
        ? `${message} Payslips downloaded successfully.`
        : payslipResult
          ? `${message} However, payslip generation failed. ${payslipResult.error ?? 'Please try again through the Generate Payslips button.'}`
          : message;

      await Swal.fire({
        title: payslipSuccess
          ? 'Success!'
          : payslipResult
            ? 'Payroll Generated'
            : 'Success!',
        text: infoMessage,
        icon: payslipSuccess
          ? 'success'
          : payslipResult
            ? 'warning'
            : 'success',
        confirmButtonColor: payslipSuccess ? '#3085d6' : '#f59e0b',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to generate payroll. Please try again.';
      logger.error('Error generating payroll:', error);

      await Swal.fire({
        title: 'Error!',
        text: message,
        icon: 'error',
        confirmButtonColor: '#d33',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
    } finally {
      setIsGeneratingPayroll(false);
    }
  };

  const handleGeneratePayslips = async () => {
    if (isGeneratingPayslips) {
      return;
    }

    if (payPeriodFilter === 'all') {
      await Swal.fire({
        title: 'Select Pay Period',
        text: 'Please choose a specific pay period filter before generating payslips.',
        icon: 'info',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
      return;
    }

    const parsed = parsePayPeriodLabel(payPeriodFilter);

    if (!parsed) {
      await Swal.fire({
        title: 'Invalid Pay Period',
        text: 'Unable to determine the selected pay period. Please try again.',
        icon: 'error',
        confirmButtonColor: '#d33',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
      return;
    }

    const result = await generatePayslipsForPeriod({
      periodStart: parsed.start,
      periodEnd: parsed.end,
      payPeriodLabel: payPeriodFilter,
    });

    await Swal.fire({
      title: result.success ? 'Payslips Ready' : 'Failed to Generate Payslips',
      text: result.success
        ? `Payslips for ${payPeriodFilter} have been downloaded as a ZIP file.`
        : (result.error ?? 'Please try again later.'),
      icon: result.success ? 'success' : 'error',
      confirmButtonColor: result.success ? '#3085d6' : '#d33',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
    });
  };

  const handleOpenManualPayroll = () => {
    setEditingPayroll(null);
    setIsFormOpen(true);
  };

  const handleEditPayroll = (payroll: Payroll) => {
    setEditingPayroll(payroll);
    setIsFormOpen(true);
  };

  const handleDeletePayroll = async (id: string) => {
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

  const handleSavePayroll = async (formData: PayrollFormData) => {
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
      // Update existing payroll
      updateMutation.mutate({ id: editingPayroll.id, ...payload });
    } else {
      // Add new payroll
      createMutation.mutate({
        ...payload,
        periodStart: formData.payPeriod.split(' to ')[0],
        periodEnd: formData.payPeriod.split(' to ')[1],
        status: 'pending',
      });
    }
  };

  const handleApprove = async (id: string) => {
    updateMutation.mutate({
      id,
      status: 'approved',
      approvedBy: 'Current User',
      approvedDate: getCurrentDateISO(),
    });
  };

  const handleApproveAll = async () => {
    const pending = filteredPayrolls.filter((p) => p.status === 'pending');
    if (pending.length === 0) {
      await Swal.fire({
        title: 'No Pending Payrolls',
        text: 'There are no pending payrolls in the current view to approve.',
        icon: 'info',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Approve All Pending Payrolls?',
      html: `You are about to approve <strong>${pending.length}</strong> payroll record${pending.length === 1 ? '' : 's'}.<br/><br/>This applies only to the records matching your current filters.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, approve all',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (!confirm.isConfirmed) {
      return;
    }

    setIsBulkApproving(true);

    try {
      Swal.fire({
        title: 'Approving...',
        text: 'Updating payroll statuses. Please wait.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const approvedDate = getCurrentDateISO();
      const failures: string[] = [];

      for (const payroll of pending) {
        try {
          await updateMutation.mutateAsync({
            id: payroll.id,
            status: 'approved',
            approvedBy: 'Current User',
            approvedDate,
          });
        } catch (error) {
          failures.push(payroll.employee || payroll.id);
          logger.error('Error approving payroll in bulk (trucking):', error);
        }
      }

      Swal.close();

      if (failures.length > 0) {
        await Swal.fire({
          title: 'Partial Success',
          text: `Approved ${pending.length - failures.length} record(s). Failed: ${failures.join(', ')}.`,
          icon: 'warning',
          confirmButtonColor: '#f59e0b',
          allowOutsideClick: false,
        });
        return;
      }

      await Swal.fire({
        title: 'Approved!',
        text: `Successfully approved ${pending.length} payroll record${pending.length === 1 ? '' : 's'}.`,
        icon: 'success',
        confirmButtonColor: '#16a34a',
        allowOutsideClick: false,
      });
    } catch (error) {
      Swal.close();
      logger.error('Error approving all trucking payrolls:', error);
      await Swal.fire({
        title: 'Approval Failed',
        text: 'Failed to approve all payrolls. Please try again.',
        icon: 'error',
        confirmButtonColor: '#d33',
        allowOutsideClick: false,
      });
    } finally {
      setIsBulkApproving(false);
    }
  };

  const syncThirteenthMonthStatus = async (
    payrollRecord: Payroll,
    paidDate: string
  ) => {
    if (!payrollRecord.thirteenthMonth || payrollRecord.thirteenthMonth <= 0) {
      return;
    }

    let year = new Date().getFullYear();
    if (payrollRecord.payPeriod) {
      const endDateStr =
        payrollRecord.payPeriod.split(' to ')[1] ||
        payrollRecord.payPeriod.split(' - ')[1] ||
        payrollRecord.payPeriod;
      const parsedDate = new Date(endDateStr);
      if (!isNaN(parsedDate.getTime())) {
        year = parsedDate.getFullYear();
      }
    }

    const employeeId = payrollRecord.employeeId || '';
    const thirteenthMonthRecordId = `${employeeId.toLowerCase()}-${year}`;

    try {
      await api.patch(
        `/api/trucking/thirteenth-month-pay/${thirteenthMonthRecordId}/status`,
        {
          status: 'paid',
          paidDate,
        }
      );
    } catch (thirteenthError) {
      logger.warn(
        'Failed to sync trucking 13th month pay status:',
        thirteenthError
      );
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    const payroll = payrolls.find((p) => p.id === id);
    if (!payroll) {
      return;
    }

    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Mark Payroll as Paid?',
      html: `
        <div style="text-align: left; padding: 0 10px;">
          <p style="margin-bottom: 15px;"><strong>Employee:</strong> ${payroll.employee}</p>
          <p style="margin-bottom: 15px;"><strong>Period:</strong> ${payroll.payPeriod}</p>
          <p style="margin-bottom: 15px;"><strong>Net Pay:</strong> ₱${(payroll.netPay ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          ${
            payroll.thirteenthMonth && payroll.thirteenthMonth > 0
              ? `
          <div style="background-color: #e0f2fe; border-left: 4px solid #0284c7; padding: 12px; margin-top: 15px;">
            <p style="margin: 0; color: #075985;">
              ℹ️ <strong>Note:</strong> This payroll includes 13th month pay (₱${payroll.thirteenthMonth.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). 
              The corresponding 13th month record will also be marked as paid.
            </p>
          </div>
          `
              : ''
          }
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Mark as Paid',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      // Show loading
      Swal.fire({
        title: 'Processing...',
        text: 'Marking payroll as paid',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const paidDate = getCurrentDateISO();

      await syncThirteenthMonthStatus(payroll, paidDate);

      // Use mutation to update status
      updateMutation.mutate({
        id,
        status: 'paid',
        paidDate,
      });

      // Show success message
      await Swal.fire({
        title: 'Marked as Paid!',
        text:
          payroll.thirteenthMonth && payroll.thirteenthMonth > 0
            ? 'Payroll and 13th month pay have been marked as paid.'
            : 'Payroll has been marked as paid.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Okay',
        allowOutsideClick: false,
        allowEscapeKey: true,
        didOpen: () => {
          Swal.hideLoading();
        },
      });
    } catch (error) {
      logger.error('Error marking payroll as paid:', error);

      // Show error message
      Swal.fire({
        title: 'Error',
        text: 'Failed to mark payroll as paid. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
      });
    }
  };

  const handleMarkAllAsPaid = async () => {
    const approved = filteredPayrolls.filter((p) => p.status === 'approved');
    if (approved.length === 0) {
      await Swal.fire({
        title: 'No Approved Payrolls',
        text: 'There are no approved payrolls in the current view to mark as paid.',
        icon: 'info',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
      return;
    }

    const totalDisbursement = approved.reduce(
      (sum, payroll) => sum + (payroll.netPay ?? 0),
      0
    );

    const confirm = await Swal.fire({
      title: 'Mark All as Paid?',
      html:
        `You are about to mark <strong>${approved.length}</strong> payroll record${approved.length === 1 ? '' : 's'} as paid.<br/><br/>` +
        `<strong>Total Disbursement:</strong> ${formatCurrency(totalDisbursement)}<br/><br/>` +
        '13th month pay entries linked to these payrolls will be updated as well.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ea5e9',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, mark all as paid',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (!confirm.isConfirmed) {
      return;
    }

    setIsBulkPaying(true);

    try {
      Swal.fire({
        title: 'Processing...',
        text: 'Marking payrolls as paid. Please wait.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const paidDate = getCurrentDateISO();
      const failures: string[] = [];

      for (const payroll of approved) {
        try {
          await syncThirteenthMonthStatus(payroll, paidDate);
          await updateMutation.mutateAsync({
            id: payroll.id,
            status: 'paid',
            paidDate,
          });
        } catch (error) {
          failures.push(payroll.employee || payroll.id);
          logger.error(
            'Error marking trucking payroll as paid in bulk:',
            error
          );
        }
      }

      Swal.close();

      if (failures.length > 0) {
        await Swal.fire({
          title: 'Partial Success',
          text: `Updated ${approved.length - failures.length} record(s). Failed: ${failures.join(', ')}.`,
          icon: 'warning',
          confirmButtonColor: '#f59e0b',
          allowOutsideClick: false,
        });
        return;
      }

      await Swal.fire({
        title: 'Payrolls Paid',
        text: `Successfully marked ${approved.length} payroll record${approved.length === 1 ? '' : 's'} as paid.`,
        icon: 'success',
        confirmButtonColor: '#10b981',
        allowOutsideClick: false,
      });
    } catch (error) {
      Swal.close();
      logger.error('Error marking all trucking payrolls as paid:', error);
      await Swal.fire({
        title: 'Bulk Update Failed',
        text: 'Failed to mark payrolls as paid. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
      });
    } finally {
      setIsBulkPaying(false);
    }
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = (e.target?.result as string) ?? '';
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length <= 1) {
          return;
        }

        const [, ...rows] = lines; // drop header

        const unmatchedEmployees = new Set<string>();

        const payload = rows.map((row) => {
          const columns = row.split(',');
          const employee = columns[0]?.trim() ?? '';
          const payPeriod = columns[1]?.trim() ?? '';
          const [periodStart = '', periodEnd = ''] = payPeriod
            .split(' to ')
            .map((value) => value.trim());

          const employeeRecord = resolveEmployeeRecord(employee);

          const parseNumber = (value: string | undefined) => {
            const parsed = parseFloat((value ?? '').trim() || '0');
            return Number.isFinite(parsed) ? parsed : 0;
          };

          const status = columns[18]?.trim().toLowerCase() || 'pending';

          if (!employeeRecord) {
            unmatchedEmployees.add(employee);
          }

          return {
            employeeId: employeeRecord?.employeeId,
            employeeName: employeeRecord?.name ?? employee,
            payPeriod,
            periodStart,
            periodEnd,
            basicSalary: parseNumber(columns[2]),
            allowance: parseNumber(columns[3]),
            overtime: parseNumber(columns[4]),
            bonuses: parseNumber(columns[5]),
            thirteenthMonth: parseNumber(columns[6]),
            grossPay: parseNumber(columns[7]),
            sss: parseNumber(columns[8]),
            philHealth: parseNumber(columns[9]),
            pagIbig: parseNumber(columns[10]),
            tax: parseNumber(columns[11]),
            loans: parseNumber(columns[12]),
            cashAdvance: parseNumber(columns[13]),
            lwop: parseNumber(columns[14]),
            absentsLates: parseNumber(columns[15]),
            totalDeductions: parseNumber(columns[16]),
            netPay: parseNumber(columns[17]),
            status,
            bankGcash: columns[19]?.trim() ?? '',
          };
        });

        if (payload.length === 0) {
          return;
        }

        await api.post('/api/trucking/payroll', payload);

        // Invalidate cache to refetch
        queryClient.invalidateQueries({ queryKey: queryKeys.payroll.lists() });

        if (unmatchedEmployees.size > 0) {
          await Swal.fire({
            title: 'Imported with Warnings',
            text: `Some employees could not be matched: ${Array.from(
              unmatchedEmployees
            ).join(
              ', '
            )}. Cash advance deductions applied only to matched employees.`,
            icon: 'warning',
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'OK',
            allowOutsideClick: false,
          });
        }
      } catch (err) {
        logger.error('Error importing payroll CSV:', err);
        await Swal.fire({
          title: 'Import Failed',
          text: 'Failed to import payroll data. Please try again.',
          icon: 'error',
          confirmButtonColor: '#d33',
          confirmButtonText: 'OK',
          allowOutsideClick: false,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee',
      'Pay Period',
      'Basic Salary',
      'Allowance',
      'Overtime',
      'Bonuses',
      'Gross Pay',
      'SSS',
      'PhilHealth',
      'Pag-IBIG',
      'Tax',
      'Loans',
      'Cash Advance',
      'LWOP',
      'Absences/Lates',
      'Total Deductions',
      'Net Pay',
      'Status',
      'Bank/GCash',
    ];
    const rows = filteredPayrolls.map((p) => [
      p.employee,
      p.payPeriod,
      p.basicSalary.toString(),
      p.allowance.toString(),
      p.overtime.toString(),
      p.bonuses.toString(),
      p.grossPay.toString(),
      p.sss.toString(),
      p.philHealth.toString(),
      p.pagIbig.toString(),
      p.tax.toString(),
      p.loans.toString(),
      p.cashAdvance.toString(),
      p.lwop.toString(),
      p.absentsLates.toString(),
      p.totalDeductions.toString(),
      p.netPay.toString(),
      p.status,
      p.bankGcash,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${getCurrentDateISO()}.csv`;
    a.click();
  };

  const getEmployeeMonthlyContributions = useCallback(
    (employeeId?: string | null, fallbackName?: string) => {
      const directoryEntry =
        resolveEmployeeRecord(employeeId) ||
        resolveEmployeeRecord(fallbackName);

      if (!directoryEntry) {
        return null;
      }

      return {
        sss:
          directoryEntry.sssMonthlyContribution !== undefined &&
          directoryEntry.sssMonthlyContribution !== null
            ? directoryEntry.sssMonthlyContribution
            : null,
        philHealth:
          directoryEntry.philHealthMonthlyContribution !== undefined &&
          directoryEntry.philHealthMonthlyContribution !== null
            ? directoryEntry.philHealthMonthlyContribution
            : null,
        pagIbig:
          directoryEntry.pagibigMonthlyContribution !== undefined &&
          directoryEntry.pagibigMonthlyContribution !== null
            ? directoryEntry.pagibigMonthlyContribution
            : null,
        tax:
          directoryEntry.taxMonthlyContribution !== undefined &&
          directoryEntry.taxMonthlyContribution !== null
            ? directoryEntry.taxMonthlyContribution
            : null,
      };
    },
    [resolveEmployeeRecord]
  );

  const handleSyncLwop = async () => {
    if (isSyncingLwop) {
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Sync LWOP Deductions?',
      text: 'This will calculate and update LWOP for all payroll records using approved unpaid leave requests.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, sync now',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setIsSyncingLwop(true);
    try {
      const result = await api.post<{
        synced: number;
        total: number;
        error?: string;
      }>('/api/trucking/payroll/sync-lwop?all=true');

      await Swal.fire({
        title: 'LWOP Synced',
        text: `Updated ${result.synced} of ${result.total} payroll record(s).`,
        icon: 'success',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });

      // Invalidate cache to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.lists() });
    } catch (error) {
      logger.error('Error syncing LWOP:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        title: 'Sync Failed',
        text: `Failed to sync LWOP: ${errorMessage}`,
        icon: 'error',
        confirmButtonColor: '#d33',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
    } finally {
      setIsSyncingLwop(false);
    }
  };

  return {
    // State
    payrolls: filteredPayrolls,
    searchQuery,
    statusFilter,
    payPeriodFilter,
    isFormOpen,
    editingPayroll,
    payPeriods,
    payPeriodOptions,
    employeeOptions,
    loading,

    // Computed Values
    totalPayrolls,
    pendingPayrolls,
    approvedPayrolls,
    totalNetPay,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setPayPeriodFilter,
    setIsFormOpen,

    // Utility Functions
    formatDate,
    formatCurrency,
    getStatusColor,
    calculateTotals,

    // Event Handlers
    handleOpenManualPayroll,
    handleAddPayroll,
    handleGeneratePayslips,
    handleEditPayroll,
    handleDeletePayroll,
    handleSavePayroll,
    handleApprove,
    handleApproveAll,
    handleMarkAsPaid,
    handleMarkAllAsPaid,
    handleImportCSV,
    handleExportCSV,
    handleSyncLwop,
    getEmployeeMonthlyContributions,

    // Loading States
    isGeneratingPayroll,
    isGeneratingPayslips,
    isSyncingLwop,
    isBulkApproving,
    isBulkPaying,
  };
}

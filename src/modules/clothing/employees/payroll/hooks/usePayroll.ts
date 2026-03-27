import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { usePayrollBase } from '@/hooks/usePayrollBase';
import { usePayrollDomainConfig } from '@/hooks/usePayrollDomainConfig';
import { usePayrollCrudActions } from '@/hooks/usePayrollCrudActions';
import {
  formatPayrollCurrency,
  formatPayrollDate,
  getPayrollStatusColor,
} from '@/lib/payroll/formatters';
import {
  calculatePayrollTotals,
  parsePayrollPeriodLabel,
} from '@/lib/payroll/form-utils';
import {
  derivePayrollFilterPeriods,
  derivePayrollSummary,
} from '@/lib/payroll/payrollSummaryUtils';
import {
  runPayrollGenerationFlow,
  runPayrollPayslipGenerationFlow,
} from '@/lib/payroll/payrollGenerationActions';
import {
  resolveThirteenthMonthRecordId,
  runMarkPayrollAsPaidFlow,
} from '@/lib/payroll/payrollPaidActions';
import { getSwal } from '@/lib/alerts';
import { getCurrentDateISO } from '@/utils/date';
import type { Payroll, PayrollFormData } from '../types';
import {
  buildPayrollExportCsv,
  parsePayrollImportRows,
} from './payrollCsvHelpers';

export function usePayroll(apiBasePath?: string) {
  const queryClient = useQueryClient();
  const { resolveApiPath, createPayrollQueryKey } = usePayrollDomainConfig(
    apiBasePath,
    '/api'
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);
  const [isGeneratingPayslips, setIsGeneratingPayslips] = useState(false);
  const [isSyncingLwop, setIsSyncingLwop] = useState(false);

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

  const { totalPayrolls, pendingPayrolls, approvedPayrolls, totalNetPay } =
    useMemo(() => derivePayrollSummary(filteredPayrolls), [filteredPayrolls]);

  const payPeriods = useMemo(
    () => derivePayrollFilterPeriods(payrolls),
    [payrolls]
  );

  const payPeriodOptions = useMemo(
    () => payPeriods.filter((period) => period && period !== 'all'),
    [payPeriods]
  );

  const formatDate = formatPayrollDate;
  const formatCurrency = formatPayrollCurrency;
  const getStatusColor = getPayrollStatusColor;
  const parsePayPeriodLabel = parsePayrollPeriodLabel;

  const calculateTotals = (formData: PayrollFormData) =>
    calculatePayrollTotals(formData);

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
          resolveApiPath('/payroll/generate-payslips'),
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
          return {
            success: false,
            error: errorData?.error || 'Failed to generate payslips.',
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

        return { success: true } as const;
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
    [isGeneratingPayslips, resolveApiPath]
  );

  const {
    updateMutation,
    handleDeletePayroll,
    handleSavePayroll,
    handleApprove,
  } = usePayrollCrudActions<Payroll>({
    payrollQueryKey,
    resolveApiPath,
    getQueryData: () => queryClient.getQueryData<Payroll[]>(payrollQueryKey),
    setQueryData: (updater) => {
      queryClient.setQueryData<Payroll[]>(payrollQueryKey, (previous) =>
        updater(previous ?? [])
      );
    },
    invalidateQuery: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKey });
    },
    cancelQuery: async () => {
      await queryClient.cancelQueries({ queryKey: payrollQueryKey });
    },
    editingPayroll,
    setEditingPayroll,
    setIsFormOpen,
    calculateTotals,
    resolveEmployeeRecord,
  });

  const handleAddPayroll = async () => {
    await runPayrollGenerationFlow({
      payrolls,
      parsePayPeriodLabel,
      isGeneratingPayroll,
      setIsGeneratingPayroll,
      resolveApiPath,
      invalidateQuery: () =>
        queryClient.invalidateQueries({ queryKey: payrollQueryKey }),
      generatePayslipsForPeriod,
      defaultGenerateErrorMessage:
        'Failed to generate payroll for the selected period.',
      cleanupDialogTitle: 'Deleted Payroll Found',
      buildSuccessMessage: ({ count, payPeriodLabel, period }) => {
        const derivedLabel =
          period?.label && period.label.trim()
            ? period.label
            : period?.start && period.end
              ? `${period.start} to ${period.end}`
              : payPeriodLabel || 'the selected period';

        return `Successfully generated payroll for ${count} employee${count === 1 ? '' : 's'} (${derivedLabel}).`;
      },
    });
  };

  const handleGeneratePayslips = async () => {
    await runPayrollPayslipGenerationFlow({
      isGeneratingPayslips,
      payPeriodFilter,
      parsePayPeriodLabel,
      generatePayslipsForPeriod,
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

  const syncThirteenthMonthStatus = async (
    payrollRecord: Payroll,
    paidDate: string
  ) => {
    if (!payrollRecord.thirteenthMonth || payrollRecord.thirteenthMonth <= 0) {
      return;
    }

    const thirteenthMonthRecordId =
      resolveThirteenthMonthRecordId(payrollRecord);

    try {
      await api.patch(
        `${resolveApiPath('/thirteenth-month-pay')}/${thirteenthMonthRecordId}/status`,
        {
          status: 'paid',
          paidDate,
        }
      );
    } catch (error) {
      logger.warn('Failed to sync 13th month pay status:', error);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    const payroll = payrolls.find((item) => item.id === id);
    await runMarkPayrollAsPaidFlow({
      payroll,
      syncThirteenthMonthStatus,
      updatePayroll: async (payload) => {
        await updateMutation.mutateAsync(payload);
      },
    });
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const Swal = await getSwal();

      try {
        const text = (event.target?.result as string) ?? '';
        const { payload, unmatchedEmployees } = parsePayrollImportRows(
          text,
          resolveEmployeeRecord
        );

        if (payload.length === 0) {
          return;
        }

        await api.post(resolveApiPath('/payroll'), payload);
        queryClient.invalidateQueries({ queryKey: payrollQueryKey });

        if (unmatchedEmployees.length > 0) {
          await Swal.fire({
            title: 'Imported with Warnings',
            text: `Some employees could not be matched: ${unmatchedEmployees.join(', ')}. Cash advance deductions applied only to matched employees.`,
            icon: 'warning',
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'OK',
            allowOutsideClick: false,
          });
        }
      } catch (error) {
        logger.error('Error importing payroll CSV:', error);
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
    const csv = buildPayrollExportCsv(filteredPayrolls);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `payroll-${getCurrentDateISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
    const Swal = await getSwal();
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
      }>(`${resolveApiPath('/payroll/sync-lwop')}?all=true`);

      await Swal.fire({
        title: 'LWOP Synced',
        text: `Updated ${result.synced} of ${result.total} payroll record(s).`,
        icon: 'success',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });

      queryClient.invalidateQueries({ queryKey: payrollQueryKey });
    } catch (error) {
      logger.error('Error syncing LWOP:', error);
      await Swal.fire({
        title: 'Sync Failed',
        text: `Failed to sync LWOP: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    totalPayrolls,
    pendingPayrolls,
    approvedPayrolls,
    totalNetPay,
    setSearchQuery,
    setStatusFilter,
    setPayPeriodFilter,
    setIsFormOpen,
    formatDate,
    formatCurrency,
    getStatusColor,
    calculateTotals,
    handleOpenManualPayroll,
    handleAddPayroll,
    handleGeneratePayslips,
    handleEditPayroll,
    handleDeletePayroll,
    handleSavePayroll,
    handleApprove,
    handleMarkAsPaid,
    handleImportCSV,
    handleExportCSV,
    handleSyncLwop,
    getEmployeeMonthlyContributions,
    isGeneratingPayroll,
    isGeneratingPayslips,
    isSyncingLwop,
  };
}

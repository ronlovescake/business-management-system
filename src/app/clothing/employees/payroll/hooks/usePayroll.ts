import { useState, useMemo, useCallback } from 'react';
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
import type { Payroll, PayrollFormData } from '../types';
import { getSwal } from '@/lib/alerts';
import {
  generatePayrollPayslipsForPeriod,
  getPayrollPayslipDownloadError,
} from './payrollPayslipGenerator';
import { exportPayrollCsv } from './payrollCsvExport';
import { importPayrollCsv } from './payrollCsvImport';
import {
  runBulkApprovePayrolls,
  runBulkMarkAllAsPaid,
} from './payrollBulkActions';

export function usePayroll(apiBasePath?: string) {
  const queryClient = useQueryClient();
  const { resolveApiPath, createPayrollQueryKey } =
    usePayrollDomainConfig(apiBasePath);

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
  const { totalPayrolls, pendingPayrolls, approvedPayrolls, totalNetPay } =
    useMemo(() => derivePayrollSummary(filteredPayrolls), [filteredPayrolls]);

  // Get unique pay periods for filter
  const payPeriods = useMemo(() => {
    return derivePayrollFilterPeriods(payrolls);
  }, [payrolls]);

  const payPeriodOptions = useMemo(
    () => payPeriods.filter((period) => period && period !== 'all'),
    [payPeriods]
  );

  // Utility Functions
  const formatDate = formatPayrollDate;
  const formatCurrency = formatPayrollCurrency;
  const getStatusColor = getPayrollStatusColor;

  const parsePayPeriodLabel = parsePayrollPeriodLabel;

  // Calculate totals from form data
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
        return await generatePayrollPayslipsForPeriod({
          resolveApiPath,
          periodStart,
          periodEnd,
          payPeriodLabel,
        });
      } catch (error) {
        return {
          success: false,
          error: getPayrollPayslipDownloadError(error),
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

  // Event Handlers
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

  const handleApproveAll = async () => {
    const Swal = await getSwal();

    await runBulkApprovePayrolls({
      payrolls: filteredPayrolls,
      setIsBulkApproving,
      fireAlert: (options) => Swal.fire(options),
      closeAlert: () => Swal.close(),
      showLoading: () => Swal.showLoading(),
      updatePayroll: async (payload) => {
        await updateMutation.mutateAsync(payload);
      },
    });
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
    } catch (thirteenthError) {
      logger.warn('Failed to sync 13th month pay status:', thirteenthError);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    const payroll = payrolls.find((p) => p.id === id);
    await runMarkPayrollAsPaidFlow({
      payroll,
      syncThirteenthMonthStatus,
      updatePayroll: async (payload) => {
        await updateMutation.mutateAsync(payload);
      },
    });
  };

  const handleMarkAllAsPaid = async () => {
    const Swal = await getSwal();

    await runBulkMarkAllAsPaid({
      payrolls: filteredPayrolls,
      formatCurrency,
      setIsBulkPaying,
      fireAlert: (options) => Swal.fire(options),
      closeAlert: () => Swal.close(),
      showLoading: () => Swal.showLoading(),
      syncThirteenthMonthStatus: async (payrollRecord, paidDate) => {
        await syncThirteenthMonthStatus(payrollRecord as Payroll, paidDate);
      },
      updatePayroll: async (payload) => {
        await updateMutation.mutateAsync(payload);
      },
    });
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    void importPayrollCsv({
      file,
      resolveApiPath,
      resolveEmployeeRecord,
      queryClient,
      payrollQueryKey,
    });
  };

  const handleExportCSV = () => {
    exportPayrollCsv(filteredPayrolls);
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
        error?: string;
      }>(`${resolveApiPath('/payroll/sync-lwop')}?all=true`);

      await Swal.fire({
        title: 'LWOP Synced',
        text: `Updated ${result.synced} of ${result.total} payroll record(s).`,
        icon: 'success',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });

      // Invalidate cache to refetch
      queryClient.invalidateQueries({ queryKey: payrollQueryKey });
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

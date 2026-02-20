import type { SweetAlertResult } from 'sweetalert2';
import { logger } from '@/lib/logger';
import { getCurrentDateISO } from '@/utils/date';

interface PayrollRecord {
  id: string;
  employee: string;
  status: string;
  netPay?: number | null;
}

interface RunBulkApprovePayrollsParams {
  payrolls: PayrollRecord[];
  setIsBulkApproving: (value: boolean) => void;
  fireAlert: (options: Record<string, unknown>) => Promise<SweetAlertResult>;
  closeAlert: () => void;
  showLoading: () => void;
  updatePayroll: (payload: {
    id: string;
    status: 'approved';
    approvedBy: string;
    approvedDate: string;
  }) => Promise<void>;
}

interface RunBulkMarkAllAsPaidParams {
  payrolls: PayrollRecord[];
  formatCurrency: (value: number) => string;
  setIsBulkPaying: (value: boolean) => void;
  fireAlert: (options: Record<string, unknown>) => Promise<SweetAlertResult>;
  closeAlert: () => void;
  showLoading: () => void;
  syncThirteenthMonthStatus: (
    payrollRecord: PayrollRecord,
    paidDate: string
  ) => Promise<void>;
  updatePayroll: (payload: {
    id: string;
    status: 'paid';
    paidDate: string;
  }) => Promise<void>;
}

export async function runBulkApprovePayrolls({
  payrolls,
  setIsBulkApproving,
  fireAlert,
  closeAlert,
  showLoading,
  updatePayroll,
}: RunBulkApprovePayrollsParams): Promise<void> {
  const pending = payrolls.filter((payroll) => payroll.status === 'pending');
  if (pending.length === 0) {
    await fireAlert({
      title: 'No Pending Payrolls',
      text: 'There are no pending payrolls in the current view to approve.',
      icon: 'info',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
    });
    return;
  }

  const confirm = await fireAlert({
    title: 'Approve All Pending Payrolls?',
    html: `You are about to approve <strong>${pending.length}</strong> payroll record${pending.length === 1 ? '' : 's'}.<br/><br/>`.concat(
      'This action applies to the records matching your current filters.'
    ),
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
    await fireAlert({
      title: 'Approving...',
      text: 'Updating payroll statuses. Please wait.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        showLoading();
      },
    });

    const approvedDate = getCurrentDateISO();
    const failures: string[] = [];

    for (const payroll of pending) {
      try {
        await updatePayroll({
          id: payroll.id,
          status: 'approved',
          approvedBy: 'Current User',
          approvedDate,
        });
      } catch (error) {
        failures.push(payroll.employee || payroll.id);
        logger.error('Error approving payroll in bulk:', error);
      }
    }

    closeAlert();

    if (failures.length > 0) {
      await fireAlert({
        title: 'Partial Success',
        text: `Approved ${pending.length - failures.length} record(s). Failed: ${failures.join(', ')}.`,
        icon: 'warning',
        confirmButtonColor: '#f59e0b',
        allowOutsideClick: false,
      });
      return;
    }

    await fireAlert({
      title: 'Approved!',
      text: `Successfully approved ${pending.length} payroll record${pending.length === 1 ? '' : 's'}.`,
      icon: 'success',
      confirmButtonColor: '#16a34a',
      allowOutsideClick: false,
    });
  } catch (error) {
    closeAlert();
    logger.error('Error approving all payrolls:', error);
    await fireAlert({
      title: 'Approval Failed',
      text: 'Failed to approve all payrolls. Please try again.',
      icon: 'error',
      confirmButtonColor: '#d33',
      allowOutsideClick: false,
    });
  } finally {
    setIsBulkApproving(false);
  }
}

export async function runBulkMarkAllAsPaid({
  payrolls,
  formatCurrency,
  setIsBulkPaying,
  fireAlert,
  closeAlert,
  showLoading,
  syncThirteenthMonthStatus,
  updatePayroll,
}: RunBulkMarkAllAsPaidParams): Promise<void> {
  const approved = payrolls.filter((payroll) => payroll.status === 'approved');
  if (approved.length === 0) {
    await fireAlert({
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

  const confirm = await fireAlert({
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
    await fireAlert({
      title: 'Processing...',
      text: 'Marking payrolls as paid. Please wait.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        showLoading();
      },
    });

    const paidDate = getCurrentDateISO();
    const failures: string[] = [];

    for (const payroll of approved) {
      try {
        await syncThirteenthMonthStatus(payroll, paidDate);
        await updatePayroll({
          id: payroll.id,
          status: 'paid',
          paidDate,
        });
      } catch (error) {
        failures.push(payroll.employee || payroll.id);
        logger.error('Error marking payroll as paid in bulk:', error);
      }
    }

    closeAlert();

    if (failures.length > 0) {
      await fireAlert({
        title: 'Partial Success',
        text: `Updated ${approved.length - failures.length} record(s). Failed: ${failures.join(', ')}.`,
        icon: 'warning',
        confirmButtonColor: '#f59e0b',
        allowOutsideClick: false,
      });
      return;
    }

    await fireAlert({
      title: 'Payrolls Paid',
      text: `Successfully marked ${approved.length} payroll record${approved.length === 1 ? '' : 's'} as paid.`,
      icon: 'success',
      confirmButtonColor: '#10b981',
      allowOutsideClick: false,
    });
  } catch (error) {
    closeAlert();
    logger.error('Error marking all payrolls as paid:', error);
    await fireAlert({
      title: 'Bulk Update Failed',
      text: 'Failed to mark payrolls as paid. Please try again.',
      icon: 'error',
      confirmButtonColor: '#ef4444',
      allowOutsideClick: false,
    });
  } finally {
    setIsBulkPaying(false);
  }
}

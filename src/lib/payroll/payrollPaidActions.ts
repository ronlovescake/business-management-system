import { logger } from '@/lib/logger';
import { getCurrentDateISO } from '@/utils/date';
import { getSwal } from '@/lib/alerts';

type PayrollPaidRecord = {
  id: string;
  employee: string;
  employeeId?: string | null;
  payPeriod: string;
  thirteenthMonth?: number | null;
  netPay?: number | null;
};

type RunMarkPayrollAsPaidFlowArgs<TPayroll extends PayrollPaidRecord> = {
  payroll: TPayroll | undefined;
  syncThirteenthMonthStatus: (
    payrollRecord: TPayroll,
    paidDate: string
  ) => Promise<void>;
  updatePayroll: (payload: {
    id: string;
    status: 'paid';
    paidDate: string;
  }) => Promise<void>;
};

export function resolveThirteenthMonthRecordId(
  payrollRecord: Pick<PayrollPaidRecord, 'employeeId' | 'payPeriod'>
) {
  let year = new Date().getFullYear();
  if (payrollRecord.payPeriod) {
    const endDateStr =
      payrollRecord.payPeriod.split(' to ')[1] ||
      payrollRecord.payPeriod.split(' - ')[1] ||
      payrollRecord.payPeriod;
    const parsedDate = new Date(endDateStr);
    if (!Number.isNaN(parsedDate.getTime())) {
      year = parsedDate.getFullYear();
    }
  }

  const employeeId = payrollRecord.employeeId || '';
  return `${employeeId.toLowerCase()}-${year}`;
}

export async function runMarkPayrollAsPaidFlow<
  TPayroll extends PayrollPaidRecord,
>({
  payroll,
  syncThirteenthMonthStatus,
  updatePayroll,
}: RunMarkPayrollAsPaidFlowArgs<TPayroll>) {
  if (!payroll) {
    return;
  }

  const Swal = await getSwal();
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
    await updatePayroll({
      id: payroll.id,
      status: 'paid',
      paidDate,
    });

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

    await Swal.fire({
      title: 'Error',
      text: 'Failed to mark payroll as paid. Please try again.',
      icon: 'error',
      confirmButtonColor: '#ef4444',
      allowOutsideClick: false,
    });
  }
}

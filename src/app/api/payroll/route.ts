import { prisma } from '@/lib/db';
import { syncPayrollDeductions } from '@/lib/payroll/deductions';
import { getCurrentDateISO } from '@/utils/date';
import { expenseService } from '@/modules/clothing/ledger/api';
import {
  createPayrollRouteHandlers,
  type PayrollRouteRecord,
} from '@/modules/shared/ledger/payroll/api/routeAdapter';

async function syncExpenseFromPayroll(
  payroll: PayrollRouteRecord,
  processedBy?: string | null
): Promise<void> {
  const paidDate = payroll.paidDate || getCurrentDateISO();
  const parsedDate = new Date(paidDate);
  const expenseDate = Number.isNaN(parsedDate.getTime())
    ? new Date()
    : parsedDate;

  const netPay = Number(payroll.netPay ?? 0);
  const amount = Number.isFinite(netPay) ? Math.max(0, netPay) : 0;

  const descriptionParts = [
    'Payroll',
    payroll.employeeName || payroll.employeeId || 'Employee',
  ];
  const description = descriptionParts.filter(Boolean).join(' - ');

  const notesParts = [
    payroll.payPeriod ? `Pay period: ${payroll.payPeriod}` : null,
    payroll.periodStart && payroll.periodEnd
      ? `Period dates: ${payroll.periodStart} to ${payroll.periodEnd}`
      : null,
  ].filter(Boolean);

  // Prefer the processor; if absent, explicitly clear to avoid showing payee
  const loggedBy = processedBy?.trim() ? processedBy.trim() : null;

  await expenseService.upsertBySource({
    date: expenseDate,
    amount,
    description,
    category: 'Payroll',
    notes: notesParts.join(' | ') || undefined,
    receipt: null,
    status: 'paid',
    employeeName: loggedBy,
    sourceType: 'PAYROLL',
    sourceId: payroll.id,
    sourceLineKey:
      payroll.payPeriod || payroll.periodEnd || payroll.periodStart || null,
    systemGenerated: true,
  });
}

const { GET, POST, PUT, DELETE } = createPayrollRouteHandlers({
  payrollModel: prisma.payroll,
  employeeModel: prisma.employee,
  createRecords: (records) =>
    prisma.$transaction(
      records.map((record) => prisma.payroll.create({ data: record }))
    ),
  syncPayrollDeductions,
  syncExpenseFromPayroll,
  shouldSync: (status) => status === 'pending',
});

export { GET, POST, PUT, DELETE };

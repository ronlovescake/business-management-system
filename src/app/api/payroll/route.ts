import type { Payroll, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  syncPayrollDeductions,
  createClothingPayrollDeductions,
} from '@/lib/payroll/deductions';
import { getCurrentDateISO } from '@/utils/date';
import { resolveThirteenthMonthRecordId } from '@/lib/payroll/thirteenthMonthIdentity';
import {
  expenseService,
  ExpenseService,
} from '@/modules/clothing/ledger/api/service';
import { ExpenseRepository } from '@/modules/clothing/ledger/api/repository';
import {
  createPayrollRouteHandlers,
  type PayrollRouteRecord,
  type PayrollRouteStore,
} from '@/modules/shared/ledger/payroll/api/routeAdapter';

async function syncExpenseFromPayroll(
  payroll: PayrollRouteRecord,
  processedBy?: string | null,
  expenses = expenseService,
  client: Prisma.TransactionClient = prisma
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

  await expenses.upsertBySource({
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

  if (payroll.thirteenthMonth > 0) {
    await client.thirteenthMonthPayRecord.update({
      where: { recordId: resolveThirteenthMonthRecordId(payroll) },
      data: { status: 'paid', paidDate },
    });
  }
}

function createPayrollStore(
  client: Prisma.TransactionClient = prisma
): PayrollRouteStore<Payroll> {
  const deductions =
    client === prisma
      ? { syncPayrollDeductions }
      : createClothingPayrollDeductions(client);
  const expenses =
    client === prisma
      ? expenseService
      : new ExpenseService(new ExpenseRepository(client));
  return {
    payrollModel: client.payroll,
    employeeModel: client.employee,
    createRecords: (records) =>
      Promise.all(records.map((data) => client.payroll.create({ data }))),
    syncPayrollDeductions: deductions.syncPayrollDeductions,
    syncExpenseFromPayroll: (payroll, processedBy) =>
      syncExpenseFromPayroll(payroll, processedBy, expenses, client),
  };
}

const { GET, POST, PUT, DELETE } = createPayrollRouteHandlers({
  ...createPayrollStore(),
  withTransaction: (operation) =>
    prisma.$transaction((client) => operation(createPayrollStore(client)), {
      isolationLevel: 'Serializable',
      timeout: 30000,
    }),
  shouldSync: (status) => status === 'pending',
  lockPaidRecords: true,
});

export { GET, POST, PUT, DELETE };

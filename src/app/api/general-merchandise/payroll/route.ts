import type { PayrollInput } from '@/lib/validations/payroll.validation';
import { prisma } from '@/lib/db';
import { syncPayrollDeductionsGeneralMerchandise } from '@/lib/payroll/deductionsGeneralMerchandise';
import {
  createPayrollRouteHandlers,
  type PayrollRouteRecord,
} from '@/modules/shared/ledger/payroll/api/routeAdapter';

type GeneralMerchandisePayrollClient = Pick<
  typeof prisma,
  | 'generalMerchandisePayroll'
  | 'generalMerchandiseEmployee'
  | 'generalMerchandiseExpense'
>;

const gmPrisma: GeneralMerchandisePayrollClient = prisma;

async function createPayrollRecords(records: PayrollInput[]) {
  return prisma.$transaction(async (tx) => {
    const gmTx: GeneralMerchandisePayrollClient = tx;
    const created = [];

    for (const record of records) {
      const payroll = await gmTx.generalMerchandisePayroll.create({
        data: record,
      });
      created.push(payroll);
    }

    return created;
  });
}

async function upsertGeneralMerchandiseExpense(payload: {
  date: Date;
  amount: number;
  description: string;
  category: string;
  notes?: string;
  receipt?: string | null;
  status: string;
  employeeName?: string | null;
  sourceType: string;
  sourceId: string;
  sourceLineKey?: string | null;
  systemGenerated?: boolean;
  paymentMethod?: string | null;
  paymentCardId?: string | null;
}) {
  const dateValue = payload.date.toISOString().split('T')[0];

  const sourceLineKey = payload.sourceLineKey ?? '';

  return gmPrisma.generalMerchandiseExpense.upsert({
    where: {
      sourceType_sourceId_sourceLineKey: {
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        sourceLineKey,
      },
    },
    create: {
      date: dateValue,
      amount: payload.amount,
      description: payload.description,
      category: payload.category,
      notes: payload.notes ?? null,
      receipt: payload.receipt ?? null,
      status: payload.status,
      employeeName:
        payload.employeeName === undefined ? null : payload.employeeName,
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      sourceLineKey,
      systemGenerated: payload.systemGenerated ?? false,
      paymentMethod: payload.paymentMethod ?? null,
      paymentCardId: payload.paymentCardId ?? null,
    },
    update: {
      date: dateValue,
      amount: payload.amount,
      description: payload.description,
      category: payload.category,
      notes: payload.notes ?? undefined,
      receipt: payload.receipt ?? undefined,
      status: payload.status,
      employeeName:
        payload.employeeName === undefined ? undefined : payload.employeeName,
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      sourceLineKey,
      systemGenerated: payload.systemGenerated ?? false,
      paymentMethod: payload.paymentMethod ?? null,
      paymentCardId: payload.paymentCardId ?? null,
    },
  });
}

async function syncExpenseFromPayroll(
  payroll: PayrollRouteRecord,
  processedBy?: string | null
): Promise<void> {
  const paidDate = payroll.paidDate || new Date().toISOString().split('T')[0];
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

  const loggedBy = processedBy?.trim() ? processedBy.trim() : null;

  await upsertGeneralMerchandiseExpense({
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
  payrollModel: gmPrisma.generalMerchandisePayroll,
  employeeModel: gmPrisma.generalMerchandiseEmployee,
  createRecords: createPayrollRecords,
  syncPayrollDeductions: syncPayrollDeductionsGeneralMerchandise,
  syncExpenseFromPayroll,
  shouldSync: (status) => status === 'pending' || status === 'approved',
  logPrefix: 'GM',
});

export { GET, POST, PUT, DELETE };

import type { Prisma } from '@prisma/client';
import type { PayrollInput } from '@/lib/validations/payroll.validation';
import { prisma } from '@/lib/db';
import { syncTruckingPayrollDeductions } from '@/lib/payroll/trucking/deductions';
import {
  createPayrollRouteHandlers,
  type PayrollRouteRecord,
} from '@/modules/shared/ledger/payroll/api/routeAdapter';

const SOURCE_TYPE = 'PAYROLL';

type TruckingPayrollClient = Pick<
  typeof prisma,
  'truckingPayroll' | 'truckingEmployee' | 'truckingExpense'
>;

const truckingPrisma: TruckingPayrollClient = prisma;

const toDateOnly = (value?: string | null): string => {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return new Date().toISOString().slice(0, 10);
};

const buildPayrollExpensePayload = (
  payroll: Prisma.TruckingPayrollUncheckedUpdateInput & { id: string }
) => {
  const amount = Number(payroll.netPay ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const lineKey = `netPay:${payroll.employeeId ?? payroll.id}`;

  const descriptionParts = [payroll.employeeName ?? 'Payroll'];
  if (payroll.payPeriod) {
    descriptionParts.push(String(payroll.payPeriod));
  }

  const resolvedDate = toDateOnly(
    (payroll as { periodEnd?: string | null }).periodEnd ||
      (payroll as { payPeriod?: string | null }).payPeriod ||
      (payroll as { periodStart?: string | null }).periodStart
  );

  return {
    sourceType: SOURCE_TYPE,
    sourceId: payroll.id,
    sourceLineKey: lineKey,
    status: 'approved',
    vehicleId: null,
    date: resolvedDate,
    systemGenerated: true,
    amount,
    category: 'Driver Pay',
    description: `${descriptionParts.join(' • ')} • Payroll`,
    employeeName:
      typeof payroll.employeeName === 'string' ? payroll.employeeName : null,
    employeeId:
      typeof payroll.employeeId === 'string' ? payroll.employeeId : null,
  } satisfies Prisma.TruckingExpenseUncheckedCreateInput;
};

const replacePayrollExpense = async (
  client: Pick<TruckingPayrollClient, 'truckingExpense'>,
  payroll: PayrollRouteRecord
) => {
  const payload = buildPayrollExpensePayload(payroll);
  const sourceLineKey = `netPay:${payroll.employeeId ?? payroll.id}`;

  await client.truckingExpense.deleteMany({
    where: {
      sourceType: SOURCE_TYPE,
      sourceId: payroll.id,
      sourceLineKey,
    },
  });

  if (!payload) {
    return;
  }

  await client.truckingExpense.create({ data: payload });
};

async function createTruckingPayrollRecords(records: PayrollInput[]) {
  return prisma.$transaction(async (tx) => {
    const truckingTx: TruckingPayrollClient = tx;
    const created = [];

    for (const record of records) {
      const payroll = await truckingTx.truckingPayroll.create({
        data: record,
      });
      created.push(payroll);
    }

    return created;
  });
}

async function syncExpenseFromPayroll(
  payroll: PayrollRouteRecord
): Promise<void> {
  await replacePayrollExpense(truckingPrisma, payroll);
}

const { GET, POST, PUT, DELETE } = createPayrollRouteHandlers({
  payrollModel: truckingPrisma.truckingPayroll,
  employeeModel: truckingPrisma.truckingEmployee,
  createRecords: createTruckingPayrollRecords,
  syncPayrollDeductions: syncTruckingPayrollDeductions,
  syncExpenseFromPayroll,
  shouldSync: (status) => status === 'pending',
  logPrefix: 'Trucking',
});

export { GET, POST, PUT, DELETE };

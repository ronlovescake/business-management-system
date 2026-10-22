import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { syncPayrollDeductionsGeneralMerchandise } from '@/lib/payroll/deductionsGeneralMerchandise';
import { calculateThirteenthMonthPayRecords } from '@/modules/shared/employees/thirteenth-month-pay/api/calculations';

export async function getCalculatedThirteenthMonthPayRecords() {
  const [employees, payrollRecords, persistedRecords] = await Promise.all([
    prisma.generalMerchandiseEmployee.findMany({
      where: { deletedAt: null },
      select: {
        employeeId: true,
        name: true,
        firstName: true,
        lastName: true,
        hireDate: true,
        status: true,
        employmentStatus: true,
      },
    }),
    prisma.generalMerchandisePayroll.findMany({
      where: { deletedAt: null },
      orderBy: [{ periodStart: 'desc' }, { employeeName: 'asc' }],
    }),
    prisma.generalMerchandiseThirteenthMonthPayRecord
      .findMany({ orderBy: [{ employeeName: 'asc' }, { year: 'desc' }] })
      .catch((error) => {
        logger.error(
          'Failed to fetch persisted 13th month pay records:',
          error
        );
        return [];
      }),
  ]);

  const payrollToSync = payrollRecords.filter(
    (payroll) => payroll.status === 'pending' || payroll.status === 'approved'
  );
  const syncedPayroll = payrollToSync.length
    ? await syncPayrollDeductionsGeneralMerchandise(payrollToSync)
    : [];
  const syncedById = new Map(
    syncedPayroll.map((payroll) => [payroll.id, payroll])
  );
  const payrollWithSyncedDeductions = payrollRecords.map(
    (payroll) => syncedById.get(payroll.id) ?? payroll
  );

  return calculateThirteenthMonthPayRecords({
    employees: employees as unknown as Array<Record<string, unknown>>,
    payrollRecords: payrollWithSyncedDeductions as unknown as Array<
      Record<string, unknown>
    >,
    persistedRecords: persistedRecords as unknown as Array<
      Record<string, unknown>
    >,
  });
}

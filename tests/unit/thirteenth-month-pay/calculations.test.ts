import { describe, expect, it } from 'vitest';
import { calculateThirteenthMonthPayRecords } from '@/modules/shared/employees/thirteenth-month-pay/api/calculations';

describe('calculateThirteenthMonthPayRecords', () => {
  it('includes payroll rows of every status and preserves the existing formula', () => {
    const records = calculateThirteenthMonthPayRecords({
      employees: [
        {
          employeeId: 'EMP-001',
          name: 'Avery Worker',
          hireDate: '2020-01-01',
          status: 'Active',
        },
      ],
      payrollRecords: [
        {
          employeeId: 'EMP-001',
          employeeName: 'Avery Worker',
          periodStart: '2025-01-01',
          periodEnd: '2025-01-15',
          payPeriod: '2025-01-01 to 2025-01-15',
          basicSalary: 12000,
          lwop: 1000,
          absentsLates: 500,
          status: 'pending',
        },
        {
          employeeId: 'EMP-001',
          employeeName: 'Avery Worker',
          periodStart: '2025-02-01',
          periodEnd: '2025-02-15',
          payPeriod: '2025-02-01 to 2025-02-15',
          basicSalary: 18000,
          lwop: 0,
          absentsLates: 0,
          status: 'paid',
        },
      ],
      persistedRecords: [],
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'emp-001-2025',
      employee: 'Avery Worker',
      year: '2025',
      totalBasicSalary: 30000,
      totalLwop: 1000,
      totalAbsencesLates: 500,
      netBasicSalary: 28500,
      thirteenthMonthPay: 2375,
      monthsWorked: 2,
      status: 'calculated',
    });
  });

  it('keeps approved amounts locked while refreshing employee details', () => {
    const records = calculateThirteenthMonthPayRecords({
      employees: [
        {
          employeeId: 'EMP-002',
          name: 'Updated Name',
          hireDate: '2022-03-01',
          status: 'Active',
        },
      ],
      payrollRecords: [
        {
          employeeId: 'EMP-002',
          employeeName: 'Updated Name',
          periodEnd: '2025-12-31',
          basicSalary: 12000,
          lwop: 0,
          absentsLates: 0,
        },
      ],
      persistedRecords: [
        {
          id: 'database-id',
          recordId: 'emp-002-2025',
          employeeId: 'EMP-002',
          employeeName: 'Old Name',
          year: 2025,
          status: 'approved',
          totalBasicSalary: 9000,
          totalLwop: 1000,
          totalAbsencesLates: 0,
          netBasicSalary: 8000,
          monthsWorked: 1,
          thirteenthMonthPay: 666.67,
          approvedDate: '2025-12-20',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'emp-002-2025',
      employee: 'Old Name',
      employmentStatus: 'Active',
      totalBasicSalary: 9000,
      netBasicSalary: 8000,
      thirteenthMonthPay: 666.67,
      status: 'approved',
      approvedDate: '2025-12-20',
      hireDate: '2022-03-01',
    });
  });
});

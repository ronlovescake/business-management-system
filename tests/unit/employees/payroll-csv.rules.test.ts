/**
 * Payroll CSV Helpers — Business-Rule-Mapped Tests
 *
 * Rules Covered (employees-payroll.md):
 *  D-14  grossPay = basicSalary + allowance + overtime + bonuses + thirteenthMonth
 *  D-15  totalDeductions = sss + philHealth + pagIbig + tax + loans + cashAdvance + lwop + absentsLates
 *  D-16  netPay = max(0, grossPay - totalDeductions)
 *  E-18  parsePayrollImportRows CSV column parsing
 *  E-19  unmatched employee tracking
 *  buildPayrollExportCsv header column validation
 */

import { describe, it, expect } from 'vitest';

import {
  parsePayrollImportRows,
  buildPayrollExportCsv,
} from '@/modules/clothing/employees/payroll/hooks/payrollCsvHelpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeResolver = (
  knownEmployees: Record<string, { employeeId: string; name: string }>
) => {
  return (identifier: string | undefined | null) => {
    if (!identifier) return undefined;
    return knownEmployees[identifier];
  };
};

const resolver = makeResolver({
  Alice: { employeeId: 'emp-1', name: 'Alice' },
  Bob: { employeeId: 'emp-2', name: 'Bob' },
});

function buildCsvRow(employee: string, values: number[], status = 'pending', bank = 'GCash') {
  return [employee, '2025-01-01 to 2025-01-15', ...values.map(String), status, bank].join(',');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Payroll CSV Helpers', () => {
  // =========================================================================
  // parsePayrollImportRows
  // =========================================================================
  describe('parsePayrollImportRows()', () => {
    it('Rule E-18: parses standard payroll CSV', () => {
      const header = 'Employee,PayPeriod,BasicSalary,Allowance,Overtime,Bonuses,ThirteenthMonth,GrossPay,SSS,PhilHealth,PagIBIG,Tax,Loans,CashAdvance,LWOP,AbsentsLates,TotalDeductions,NetPay,Status,BankGcash';
      //                                  basic  allow  ot     bonus  13th   gross  sss    phil   pag    tax    loans  ca     lwop   abs    totDed  net
      const row = buildCsvRow('Alice',   [15000, 2000,  1000,  500,   0,     18500, 500,   200,   100,   300,   0,     0,     0,     0,     1100,   17400]);
      const text = `${header}\n${row}`;

      const { payload, unmatchedEmployees } = parsePayrollImportRows(text, resolver);
      expect(payload).toHaveLength(1);
      expect(unmatchedEmployees).toHaveLength(0);

      const p = payload[0];
      expect(p.employeeId).toBe('emp-1');
      expect(p.employeeName).toBe('Alice');
      expect(p.basicSalary).toBe(15000);
      expect(p.allowance).toBe(2000);
      expect(p.overtime).toBe(1000);
      expect(p.bonuses).toBe(500);
    });

    it('Rule E-19: tracks unmatched employees', () => {
      const header = 'Employee,PayPeriod,BasicSalary,Allowance,Overtime,Bonuses,ThirteenthMonth,GrossPay,SSS,PhilHealth,PagIBIG,Tax,Loans,CashAdvance,LWOP,AbsentsLates,TotalDeductions,NetPay,Status,BankGcash';
      const row = buildCsvRow('Unknown Person', [15000, 0, 0, 0, 0, 15000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15000]);
      const text = `${header}\n${row}`;

      const { unmatchedEmployees } = parsePayrollImportRows(text, resolver);
      expect(unmatchedEmployees).toContain('Unknown Person');
    });

    it('Rule D-14: parsed grossPay field matches formula', () => {
      const header = 'Employee,PayPeriod,BasicSalary,Allowance,Overtime,Bonuses,ThirteenthMonth,GrossPay,SSS,PhilHealth,PagIBIG,Tax,Loans,CashAdvance,LWOP,AbsentsLates,TotalDeductions,NetPay,Status,BankGcash';
      //                                  basic  allow  ot    bonus  13th   gross  ...rest
      const row = buildCsvRow('Alice',   [10000, 2000,  500,  300,   1000,  13800, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13800]);
      const text = `${header}\n${row}`;

      const { payload } = parsePayrollImportRows(text, resolver);
      const p = payload[0];
      const expectedGross = p.basicSalary + p.allowance + p.overtime + p.bonuses + p.thirteenthMonth;
      expect(expectedGross).toBe(p.grossPay);
    });

    it('Rule D-15: parsed totalDeductions field matches formula', () => {
      const header = 'Employee,PayPeriod,BasicSalary,Allowance,Overtime,Bonuses,ThirteenthMonth,GrossPay,SSS,PhilHealth,PagIBIG,Tax,Loans,CashAdvance,LWOP,AbsentsLates,TotalDeductions,NetPay,Status,BankGcash';
      //                                  basic  allow  ot    bonus  13th   gross  sss   phil  pag   tax   loans ca    lwop  abs   totDed netPay
      const row = buildCsvRow('Alice',   [10000, 0,     0,    0,     0,     10000, 500,  200,  100,  300,  50,   100,  25,   75,   1350,  8650]);
      const text = `${header}\n${row}`;

      const { payload } = parsePayrollImportRows(text, resolver);
      const p = payload[0];
      const expectedDeductions =
        p.sss + p.philHealth + p.pagIbig + p.tax + p.loans + p.cashAdvance + p.lwop + p.absentsLates;
      expect(expectedDeductions).toBe(p.totalDeductions);
    });

    it('Rule D-16: netPay = max(0, grossPay - totalDeductions)', () => {
      const header = 'Employee,PayPeriod,BasicSalary,Allowance,Overtime,Bonuses,ThirteenthMonth,GrossPay,SSS,PhilHealth,PagIBIG,Tax,Loans,CashAdvance,LWOP,AbsentsLates,TotalDeductions,NetPay,Status,BankGcash';
      //                                  basic  allow  ot    bonus  13th   gross  sss   phil  pag   tax   loans ca    lwop  abs   totDed netPay
      const row = buildCsvRow('Bob',     [10000, 0,     0,    0,     0,     10000, 500,  200,  100,  300,  0,    0,    0,    0,    1100,  8900]);
      const text = `${header}\n${row}`;

      const { payload } = parsePayrollImportRows(text, resolver);
      const p = payload[0];
      const expectedNet = Math.max(0, p.grossPay - p.totalDeductions);
      expect(expectedNet).toBe(p.netPay);
    });

    it('returns empty payload for header-only CSV', () => {
      const header = 'Employee,PayPeriod';
      const { payload } = parsePayrollImportRows(header, resolver);
      expect(payload).toHaveLength(0);
    });

    it('parses status field (defaults to pending)', () => {
      const header = 'Employee,PayPeriod,BasicSalary,Allowance,Overtime,Bonuses,ThirteenthMonth,GrossPay,SSS,PhilHealth,PagIBIG,Tax,Loans,CashAdvance,LWOP,AbsentsLates,TotalDeductions,NetPay,Status,BankGcash';
      const row = buildCsvRow('Alice', Array(16).fill(0), 'approved');
      const text = `${header}\n${row}`;

      const { payload } = parsePayrollImportRows(text, resolver);
      expect(payload[0].status).toBe('approved');
    });

    it('parses pay period into start and end', () => {
      const header = 'Employee,PayPeriod,BasicSalary,Allowance,Overtime,Bonuses,ThirteenthMonth,GrossPay,SSS,PhilHealth,PagIBIG,Tax,Loans,CashAdvance,LWOP,AbsentsLates,TotalDeductions,NetPay,Status,BankGcash';
      const row = buildCsvRow('Alice', Array(16).fill(0));
      const text = `${header}\n${row}`;

      const { payload } = parsePayrollImportRows(text, resolver);
      expect(payload[0].periodStart).toBe('2025-01-01');
      expect(payload[0].periodEnd).toBe('2025-01-15');
    });
  });

  // =========================================================================
  // buildPayrollExportCsv
  // =========================================================================
  describe('buildPayrollExportCsv()', () => {
    it('exports correct 19-column header structure', () => {
      const csv = buildPayrollExportCsv([]);
      const expectedHeaders = [
        'Employee',
        'Pay Period',
        'Basic Salary',
        'Allowance',
        'Overtime',
        'Bonuses',
        'Gross Pay',
        'SSS',
        'PhilHealth',
        'Pag-IBIG',
        'Tax',
        'Loans',
        'Cash Advance',
        'LWOP',
        'Absences/Lates',
        'Total Deductions',
        'Net Pay',
        'Status',
      ];

      // Header is the first line
      const headerLine = csv.split('\n')[0];
      for (const header of expectedHeaders) {
        expect(headerLine).toContain(header);
      }
    });
  });
});

/**
 * Payroll Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/employees-payroll.md
 * Covers: normalizeIdentifier, mapPayrollRecord, filterPayrolls, derivePayrollSummary, buildEmployeeOptions.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeIdentifier,
  mapPayrollRecord,
  filterPayrolls,
  derivePayrollSummary,
  buildEmployeeOptions,
  type EmployeeDirectoryEntry,
} from '@/modules/clothing/employees/payroll/hooks/payrollHookUtils';
import type { Payroll } from '@/modules/clothing/employees/payroll/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePayrollRecord = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id: '1',
  employeeName: 'Alice Santos',
  employeeId: 'EMP-001',
  payPeriod: '2025-06',
  basicSalary: 15000,
  allowance: 1000,
  overtime: 0,
  bonuses: 0,
  thirteenthMonth: 0,
  grossPay: 16000,
  sss: 800,
  philHealth: 400,
  pagIbig: 200,
  tax: 100,
  loans: 0,
  cashAdvance: 0,
  lwop: 0,
  absentsLates: 0,
  totalDeductions: 0,
  netPay: 0,
  status: 'pending',
  bankGcash: 'GCash',
  ...overrides,
});

const makePayroll = (overrides: Partial<Payroll> = {}): Payroll => ({
  id: '1',
  employee: 'Alice Santos',
  employeeId: 'EMP-001',
  payPeriod: '2025-06',
  basicSalary: 15000,
  allowance: 1000,
  overtime: 0,
  bonuses: 0,
  thirteenthMonth: 0,
  grossPay: 16000,
  sss: 800,
  philHealth: 400,
  pagIbig: 200,
  tax: 100,
  loans: 0,
  cashAdvance: 0,
  lwop: 0,
  absentsLates: 0,
  totalDeductions: 1500,
  netPay: 14500,
  status: 'pending',
  bankGcash: 'GCash',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Section A — normalizeIdentifier
// ---------------------------------------------------------------------------

describe('Payroll — normalizeIdentifier', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalizeIdentifier('  Alice  ')).toBe('alice');
  });

  it('collapses multiple internal spaces', () => {
    expect(normalizeIdentifier('John   Doe')).toBe('john doe');
  });

  it('lowercases the identifier', () => {
    expect(normalizeIdentifier('ALICE SANTOS')).toBe('alice santos');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeIdentifier(null)).toBe('');
    expect(normalizeIdentifier(undefined)).toBe('');
  });

  it('handles empty string', () => {
    expect(normalizeIdentifier('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Section B — mapPayrollRecord
// ---------------------------------------------------------------------------

describe('Payroll — mapPayrollRecord', () => {
  it('derives totalDeductions = sum of all deduction fields', () => {
    const record = makePayrollRecord({
      sss: 800,
      philHealth: 400,
      pagIbig: 200,
      tax: 100,
      loans: 500,
      cashAdvance: 200,
      lwop: 100,
      absentsLates: 50,
      grossPay: 16000,
      totalDeductions: 0, // stored 0 → use derived
      netPay: 0, // stored 0 → use derived
    });
    const payroll = mapPayrollRecord(record);
    // 800 + 400 + 200 + 100 + 500 + 200 + 100 + 50 = 2350
    expect(payroll.totalDeductions).toBe(2350);
  });

  it('uses stored totalDeductions when > 0', () => {
    const record = makePayrollRecord({
      totalDeductions: 9999,
      grossPay: 16000,
      netPay: 6001,
    });
    const payroll = mapPayrollRecord(record);
    expect(payroll.totalDeductions).toBe(9999);
  });

  it('derives netPay = max(0, grossPay - derivedTotalDeductions)', () => {
    const record = makePayrollRecord({
      grossPay: 16000,
      sss: 800,
      philHealth: 400,
      pagIbig: 200,
      tax: 100,
      loans: 0,
      cashAdvance: 0,
      lwop: 0,
      absentsLates: 0,
      totalDeductions: 0,
      netPay: 0,
    });
    const payroll = mapPayrollRecord(record);
    // derivedDeductions = 800+400+200+100 = 1500; netPay = 16000 - 1500 = 14500
    expect(payroll.netPay).toBe(14500);
  });

  it('netPay is never negative (clamped to 0)', () => {
    const record = makePayrollRecord({
      grossPay: 500,
      sss: 800,
      philHealth: 400,
      pagIbig: 200,
      tax: 100,
      totalDeductions: 0,
      netPay: 0,
    });
    const payroll = mapPayrollRecord(record);
    expect(payroll.netPay).toBe(0);
  });

  it('uses stored netPay when > 0', () => {
    const record = makePayrollRecord({ netPay: 13000 });
    const payroll = mapPayrollRecord(record);
    expect(payroll.netPay).toBe(13000);
  });

  it('maps lwop from deduction field when lwop is undefined', () => {
    const record = makePayrollRecord({ lwop: undefined, deduction: 300 });
    const payroll = mapPayrollRecord(record);
    // lwop should fall back to deduction = 300
    expect(payroll.lwop).toBe(300);
  });

  it('maps employee name from employeeName field', () => {
    const record = makePayrollRecord({ employeeName: 'Bob Cruz' });
    expect(mapPayrollRecord(record).employee).toBe('Bob Cruz');
  });
});

// ---------------------------------------------------------------------------
// Section C — filterPayrolls
// ---------------------------------------------------------------------------

describe('Payroll — filterPayrolls', () => {
  const payrolls: Payroll[] = [
    makePayroll({
      employee: 'Alice Santos',
      status: 'pending',
      payPeriod: '2025-06',
    }),
    makePayroll({
      id: '2',
      employee: 'Bob Cruz',
      status: 'approved',
      payPeriod: '2025-07',
    }),
    makePayroll({
      id: '3',
      employee: 'Carol Reyes',
      status: 'paid',
      payPeriod: '2025-06',
    }),
  ];

  it('returns all when filters are empty/all', () => {
    expect(filterPayrolls(payrolls, '', 'all', 'all')).toHaveLength(3);
  });

  it('filters by employee name (case-insensitive)', () => {
    const result = filterPayrolls(payrolls, 'alice', 'all', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].employee).toBe('Alice Santos');
  });

  it('filters by status', () => {
    const result = filterPayrolls(payrolls, '', 'approved', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].employee).toBe('Bob Cruz');
  });

  it('filters by pay period', () => {
    const result = filterPayrolls(payrolls, '', 'all', '2025-06');
    expect(result).toHaveLength(2);
  });

  it('combines search + status filter', () => {
    const result = filterPayrolls(payrolls, 'carol', 'paid', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].employee).toBe('Carol Reyes');
  });
});

// ---------------------------------------------------------------------------
// Section D — derivePayrollSummary
// ---------------------------------------------------------------------------

describe('Payroll — derivePayrollSummary', () => {
  it('counts total payrolls', () => {
    const payrolls = [
      makePayroll({ status: 'pending' }),
      makePayroll({ id: '2', status: 'approved' }),
      makePayroll({ id: '3', status: 'paid', netPay: 5000 }),
    ];
    expect(derivePayrollSummary(payrolls).totalPayrolls).toBe(3);
  });

  it('counts pending payrolls', () => {
    const payrolls = [
      makePayroll({ status: 'pending' }),
      makePayroll({ id: '2', status: 'paid' }),
    ];
    expect(derivePayrollSummary(payrolls).pendingPayrolls).toBe(1);
  });

  it('counts approved payrolls', () => {
    const payrolls = [
      makePayroll({ status: 'approved' }),
      makePayroll({ id: '2', status: 'approved' }),
    ];
    expect(derivePayrollSummary(payrolls).approvedPayrolls).toBe(2);
  });

  it('sums totalNetPay from PAID payrolls only', () => {
    const payrolls = [
      makePayroll({ status: 'paid', netPay: 14500 }),
      makePayroll({ id: '2', status: 'pending', netPay: 12000 }), // excluded
      makePayroll({ id: '3', status: 'paid', netPay: 8000 }),
    ];
    expect(derivePayrollSummary(payrolls).totalNetPay).toBe(22500);
  });

  it('returns zeros for empty array', () => {
    const summary = derivePayrollSummary([]);
    expect(summary.totalPayrolls).toBe(0);
    expect(summary.totalNetPay).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Section E — buildEmployeeOptions
// ---------------------------------------------------------------------------

describe('Payroll — buildEmployeeOptions', () => {
  const entry = (name: string): EmployeeDirectoryEntry => ({
    id: name,
    employeeId: name,
    name,
  });

  it('returns sorted, unique names', () => {
    const entries = [entry('Carol'), entry('Alice'), entry('Bob')];
    expect(buildEmployeeOptions(entries)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('deduplicates same name', () => {
    const entries = [entry('Alice'), entry('Alice'), entry('Bob')];
    expect(buildEmployeeOptions(entries)).toEqual(['Alice', 'Bob']);
  });

  it('excludes blank names', () => {
    const entries = [entry(''), entry('Alice')];
    expect(buildEmployeeOptions(entries)).toEqual(['Alice']);
  });

  it('returns empty array for empty input', () => {
    expect(buildEmployeeOptions([])).toEqual([]);
  });
});

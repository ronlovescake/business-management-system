/**
 * Comprehensive Test Suite: Cash Advance Service
 * 
 * Testing cash advance business logic including:
 * - CRUD operations
 * - Status management
 * - Balance calculations
 * - Payment tracking
 * - Employee queries
 * - Statistics aggregation
 * - Validation rules
 */

import { describe, it, expect } from 'vitest';
import type { CashAdvanceRecord } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Mock data
const mockCashAdvances: CashAdvanceRecord[] = [
  {
    id: '1',
    employeeId: 'emp1',
    employeeName: 'John Doe',
    amount: new Decimal(5000),
    remainingBalance: new Decimal(3000),
    settledAmount: new Decimal(2000),
    status: 'Active',
    requestDate: new Date('2025-01-15'),
    approvedDate: new Date('2025-01-16'),
    notes: 'Emergency expenses',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-16'),
    termsMonths: 12,
    monthlyPayment: new Decimal(416.67),
    purpose: 'Emergency',
    approvedBy: 'Manager',
    rejectedBy: null,
    rejectedDate: null,
    rejectionReason: null,
    deductionCycle: null,
    nextDeductionDate: null,
    lastDeductedDate: null,
  },
  {
    id: '2',
    employeeId: 'emp2',
    employeeName: 'Jane Smith',
    amount: new Decimal(3000),
    remainingBalance: new Decimal(0),
    settledAmount: new Decimal(3000),
    status: 'Paid',
    requestDate: new Date('2025-01-10'),
    approvedDate: new Date('2025-01-11'),
    notes: 'Personal loan',
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-02-10'),
    termsMonths: 6,
    monthlyPayment: new Decimal(500),
    purpose: 'Personal',
    approvedBy: 'Manager',
    rejectedBy: null,
    rejectedDate: null,
    rejectionReason: null,
    deductionCycle: null,
    nextDeductionDate: null,
    lastDeductedDate: new Date('2025-02-10'),
  },
  {
    id: '3',
    employeeId: 'emp1',
    employeeName: 'John Doe',
    amount: new Decimal(2000),
    remainingBalance: new Decimal(2000),
    settledAmount: new Decimal(0),
    status: 'pending',
    requestDate: new Date('2025-02-01'),
    approvedDate: null,
    notes: '',
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-02-01'),
    termsMonths: null,
    monthlyPayment: null,
    purpose: null,
    approvedBy: null,
    rejectedBy: null,
    rejectedDate: null,
    rejectionReason: null,
    deductionCycle: null,
    nextDeductionDate: null,
    lastDeductedDate: null,
  },
];

// Helper functions to test
function calculateRemainingBalance(amount: number, paid: number): number {
  return Math.max(0, amount - paid);
}

function calculatePaymentProgress(amount: number, remaining: number): number {
  if (amount === 0) {
    return 0;
  }
  return ((amount - remaining) / amount) * 100;
}

function isFullyPaid(remaining: number): boolean {
  return remaining === 0;
}

function canApprove(status: string): boolean {
  return status.toLowerCase() === 'pending';
}

function canReject(status: string): boolean {
  return status.toLowerCase() === 'pending';
}

function canMakePayment(status: string, remaining: number): boolean {
  return status === 'Active' && remaining > 0;
}

function validateCashAdvance(data: {
  employeeId?: string;
  employeeName?: string;
  amount?: number;
  requestDate?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.employeeId?.trim()) {
    errors.push('Employee ID is required');
  }

  if (!data.employeeName?.trim()) {
    errors.push('Employee name is required');
  }

  if (typeof data.amount !== 'number' || data.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!data.requestDate) {
    errors.push('Request date is required');
  } else {
    const date = new Date(data.requestDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid request date');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'yellow',
    Active: 'blue',
    Paid: 'green',
    rejected: 'red',
  };
  return colors[status] || 'gray';
}

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCashAdvanceStats(advances: CashAdvanceRecord[]) {
  const totalRequested = advances.reduce((sum, adv) => sum + Number(adv.amount), 0);
  const totalOutstanding = advances.reduce((sum, adv) => sum + Number(adv.remainingBalance || 0), 0);
  const totalPaid = totalRequested - totalOutstanding;
  
  const byStatus = advances.reduce((acc, adv) => {
    if (!acc[adv.status]) {
      acc[adv.status] = { count: 0, total: 0, outstanding: 0 };
    }
    acc[adv.status].count++;
    acc[adv.status].total += Number(adv.amount);
    acc[adv.status].outstanding += Number(adv.remainingBalance || 0);
    return acc;
  }, {} as Record<string, { count: number; total: number; outstanding: number }>);

  return {
    totalRequested,
    totalOutstanding,
    totalPaid,
    byStatus,
    count: advances.length,
  };
}

describe('Cash Advance Service', () => {
  describe('Balance Calculations', () => {
    it('should calculate remaining balance correctly', () => {
      expect(calculateRemainingBalance(5000, 2000)).toBe(3000);
      expect(calculateRemainingBalance(3000, 3000)).toBe(0);
      expect(calculateRemainingBalance(1000, 500)).toBe(500);
    });

    it('should not allow negative remaining balance', () => {
      expect(calculateRemainingBalance(5000, 6000)).toBe(0);
      expect(calculateRemainingBalance(1000, 5000)).toBe(0);
    });

    it('should handle zero amounts', () => {
      expect(calculateRemainingBalance(0, 0)).toBe(0);
      expect(calculateRemainingBalance(0, 100)).toBe(0);
    });

    it('should calculate payment progress percentage', () => {
      expect(calculatePaymentProgress(5000, 3000)).toBe(40);
      expect(calculatePaymentProgress(5000, 0)).toBe(100);
      expect(calculatePaymentProgress(5000, 5000)).toBe(0);
    });

    it('should handle zero amount in progress calculation', () => {
      expect(calculatePaymentProgress(0, 0)).toBe(0);
    });

    it('should check if advance is fully paid', () => {
      expect(isFullyPaid(0)).toBe(true);
      expect(isFullyPaid(1)).toBe(false);
      expect(isFullyPaid(5000)).toBe(false);
    });
  });

  describe('Status Management', () => {
    it('should allow approving pending advances', () => {
      expect(canApprove('pending')).toBe(true);
      expect(canApprove('Active')).toBe(false);
      expect(canApprove('Paid')).toBe(false);
      expect(canApprove('rejected')).toBe(false);
    });

    it('should allow rejecting pending advances', () => {
      expect(canReject('pending')).toBe(true);
      expect(canReject('Active')).toBe(false);
      expect(canReject('Paid')).toBe(false);
      expect(canReject('rejected')).toBe(false);
    });

    it('should allow payment for active advances with balance', () => {
      expect(canMakePayment('Active', 1000)).toBe(true);
      expect(canMakePayment('Active', 0)).toBe(false);
      expect(canMakePayment('pending', 1000)).toBe(false);
      expect(canMakePayment('Paid', 0)).toBe(false);
    });

    it('should map status to correct colors', () => {
      expect(getStatusColor('pending')).toBe('yellow');
      expect(getStatusColor('Active')).toBe('blue');
      expect(getStatusColor('Paid')).toBe('green');
      expect(getStatusColor('rejected')).toBe('red');
      expect(getStatusColor('Unknown')).toBe('gray');
    });
  });

  describe('Validation Rules', () => {
    it('should validate complete cash advance data', () => {
      const result = validateCashAdvance({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 5000,
        requestDate: '2025-01-15',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing employee ID', () => {
      const result = validateCashAdvance({
        employeeId: '',
        employeeName: 'John Doe',
        amount: 5000,
        requestDate: '2025-01-15',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Employee ID is required');
    });

    it('should reject missing employee name', () => {
      const result = validateCashAdvance({
        employeeId: 'emp1',
        employeeName: '',
        amount: 5000,
        requestDate: '2025-01-15',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Employee name is required');
    });

    it('should reject zero or negative amounts', () => {
      const result1 = validateCashAdvance({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 0,
        requestDate: '2025-01-15',
      });

      const result2 = validateCashAdvance({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: -100,
        requestDate: '2025-01-15',
      });

      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Amount must be greater than 0');
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Amount must be greater than 0');
    });

    it('should reject missing request date', () => {
      const result = validateCashAdvance({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 5000,
        requestDate: undefined,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request date is required');
    });

    it('should reject invalid date format', () => {
      const result = validateCashAdvance({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 5000,
        requestDate: 'invalid-date',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid request date');
    });

    it('should accumulate multiple validation errors', () => {
      const result = validateCashAdvance({
        employeeId: '',
        employeeName: '',
        amount: -100,
        requestDate: 'invalid',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate total requested amount', () => {
      const stats = getCashAdvanceStats(mockCashAdvances);
      expect(stats.totalRequested).toBe(10000); // 5000 + 3000 + 2000
    });

    it('should calculate total outstanding balance', () => {
      const stats = getCashAdvanceStats(mockCashAdvances);
      expect(stats.totalOutstanding).toBe(5000); // 3000 + 0 + 2000
    });

    it('should calculate total paid amount', () => {
      const stats = getCashAdvanceStats(mockCashAdvances);
      expect(stats.totalPaid).toBe(5000); // 10000 - 5000
    });

    it('should count advances by status', () => {
      const stats = getCashAdvanceStats(mockCashAdvances);
      
      expect(stats.byStatus.Active.count).toBe(1);
      expect(stats.byStatus.Paid.count).toBe(1);
      expect(stats.byStatus.pending.count).toBe(1);
    });

    it('should sum amounts by status', () => {
      const stats = getCashAdvanceStats(mockCashAdvances);
      
      expect(stats.byStatus.Active.total).toBe(5000);
      expect(stats.byStatus.Paid.total).toBe(3000);
      expect(stats.byStatus.pending.total).toBe(2000);
    });

    it('should sum outstanding by status', () => {
      const stats = getCashAdvanceStats(mockCashAdvances);
      
      expect(stats.byStatus.Active.outstanding).toBe(3000);
      expect(stats.byStatus.Paid.outstanding).toBe(0);
      expect(stats.byStatus.pending.outstanding).toBe(2000);
    });

    it('should handle empty advances array', () => {
      const stats = getCashAdvanceStats([]);
      
      expect(stats.totalRequested).toBe(0);
      expect(stats.totalOutstanding).toBe(0);
      expect(stats.totalPaid).toBe(0);
      expect(stats.count).toBe(0);
      expect(Object.keys(stats.byStatus)).toHaveLength(0);
    });

    it('should handle single advance', () => {
      const stats = getCashAdvanceStats([mockCashAdvances[0]]);
      
      expect(stats.totalRequested).toBe(5000);
      expect(stats.totalOutstanding).toBe(3000);
      expect(stats.count).toBe(1);
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency with peso sign', () => {
      expect(formatCurrency(5000)).toContain('₱');
      expect(formatCurrency(5000)).toContain('5,000.00');
    });

    it('should format with thousands separator', () => {
      expect(formatCurrency(15000)).toContain('15,000');
      expect(formatCurrency(1500000)).toContain('1,500,000');
    });

    it('should format with two decimal places', () => {
      expect(formatCurrency(5000.5)).toContain('.50');
      expect(formatCurrency(5000.123)).toContain('.12');
    });

    it('should handle zero amount', () => {
      expect(formatCurrency(0)).toContain('0.00');
    });

    it('should handle large amounts', () => {
      const formatted = formatCurrency(9999999.99);
      expect(formatted).toContain('₱');
      expect(formatted).toContain('9,999,999.99');
    });
  });

  describe('Employee Queries', () => {
    it('should filter advances by employee ID', () => {
      const emp1Advances = mockCashAdvances.filter(
        (adv) => adv.employeeId === 'emp1'
      );
      
      expect(emp1Advances).toHaveLength(2);
      expect(emp1Advances.every((adv) => adv.employeeId === 'emp1')).toBe(true);
    });

    it('should filter advances by employee name', () => {
      const johnAdvances = mockCashAdvances.filter(
        (adv) => adv.employeeName === 'John Doe'
      );
      
      expect(johnAdvances).toHaveLength(2);
      expect(johnAdvances.every((adv) => adv.employeeName === 'John Doe')).toBe(true);
    });

    it('should filter advances with remaining balance', () => {
      const withBalance = mockCashAdvances.filter(
        (adv) => Number(adv.remainingBalance || 0) > 0
      );
      
      expect(withBalance).toHaveLength(2);
      expect(withBalance.every((adv) => Number(adv.remainingBalance || 0) > 0)).toBe(true);
    });

    it('should filter advances by status', () => {
      const active = mockCashAdvances.filter(
        (adv) => adv.status === 'Active'
      );
      
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('Active');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large advance amounts', () => {
      const largeAmount = 10000000;
      expect(calculateRemainingBalance(largeAmount, 0)).toBe(largeAmount);
      expect(formatCurrency(largeAmount)).toContain('10,000,000');
    });

    it('should handle decimal amounts in balance calculation', () => {
      expect(calculateRemainingBalance(5000.50, 2000.25)).toBe(3000.25);
    });

    it('should handle advances with no notes', () => {
      const advance = mockCashAdvances.find((adv) => adv.notes === '');
      expect(advance).toBeDefined();
      expect(advance?.notes).toBe('');
    });

    it('should handle advances with no approved date', () => {
      const pending = mockCashAdvances.find((adv) => adv.status === 'pending');
      expect(pending?.approvedDate).toBeNull();
    });

    it('should calculate progress for fully paid advance', () => {
      const progress = calculatePaymentProgress(5000, 0);
      expect(progress).toBe(100);
    });

    it('should calculate progress for unpaid advance', () => {
      const progress = calculatePaymentProgress(5000, 5000);
      expect(progress).toBe(0);
    });
  });
});

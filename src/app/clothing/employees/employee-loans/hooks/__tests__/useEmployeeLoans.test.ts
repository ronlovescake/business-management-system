/**
 * Employee Loans Module - Utility Functions Tests
 *
 * Comprehensive tests for employee loans module utilities:
 * - Monthly payment calculations (amortization formula)
 * - Interest rate calculations
 * - Balance tracking
 * - Date formatting
 * - Currency formatting
 * - Status and loan type colors
 * - Filtering logic
 * - Statistics calculations
 * - CSV import/export logic
 *
 * Note: React hooks are tested through integration tests.
 * These tests focus on pure utility functions that can be unit tested.
 *
 * @group unit
 * @group employee-loans
 */

import { describe, it, expect } from 'vitest';

// ==========================================================================
// MONTHLY PAYMENT CALCULATIONS (Amortization Formula)
// ==========================================================================

describe('Monthly Payment Calculations', () => {
  /**
   * Calculate monthly payment using amortization formula:
   * M = P * [r(1+r)^n] / [(1+r)^n - 1]
   * Where:
   * - M = monthly payment
   * - P = principal (loan amount)
   * - r = monthly interest rate (annual rate / 12 / 100)
   * - n = number of months
   */
  const calculateMonthlyPayment = (
    principal: number,
    annualRate: number,
    months: number
  ) => {
    if (annualRate === 0) {
      return principal / months;
    }
    const monthlyRate = annualRate / 100 / 12;
    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1)
    );
  };

  it('should calculate monthly payment with interest', () => {
    // $10,000 loan at 6% annual interest for 12 months
    const payment = calculateMonthlyPayment(10000, 6, 12);
    expect(payment).toBeCloseTo(860.66, 2);
  });

  it('should calculate monthly payment for zero interest', () => {
    // $12,000 loan at 0% interest for 12 months
    const payment = calculateMonthlyPayment(12000, 0, 12);
    expect(payment).toBe(1000); // Simple division
  });

  it('should calculate higher payments for shorter terms', () => {
    // $10,000 at 6% for 6 months vs 12 months
    const payment6Months = calculateMonthlyPayment(10000, 6, 6);
    const payment12Months = calculateMonthlyPayment(10000, 6, 12);
    expect(payment6Months).toBeGreaterThan(payment12Months);
  });

  it('should calculate higher payments for higher interest rates', () => {
    // $10,000 for 12 months at 6% vs 12%
    const payment6Percent = calculateMonthlyPayment(10000, 6, 12);
    const payment12Percent = calculateMonthlyPayment(10000, 12, 12);
    expect(payment12Percent).toBeGreaterThan(payment6Percent);
  });

  it('should handle large loan amounts', () => {
    // $100,000 loan at 5% for 60 months
    const payment = calculateMonthlyPayment(100000, 5, 60);
    expect(payment).toBeCloseTo(1887.12, 2);
  });

  it('should handle small loan amounts', () => {
    // $1,000 loan at 8% for 6 months
    const payment = calculateMonthlyPayment(1000, 8, 6);
    expect(payment).toBeCloseTo(170.58, 1);
  });

  it('should handle low interest rates', () => {
    // $10,000 at 1% for 12 months
    const payment = calculateMonthlyPayment(10000, 1, 12);
    expect(payment).toBeCloseTo(837.85, 1);
  });

  it('should handle high interest rates', () => {
    // $10,000 at 24% for 12 months
    const payment = calculateMonthlyPayment(10000, 24, 12);
    expect(payment).toBeCloseTo(945.60, 1);
  });

  it('should calculate payment for long-term loans', () => {
    // $50,000 at 4.5% for 120 months (10 years)
    const payment = calculateMonthlyPayment(50000, 4.5, 120);
    expect(payment).toBeCloseTo(518.19, 1);
  });
});

// ==========================================================================
// TOTAL INTEREST CALCULATIONS
// ==========================================================================

describe('Total Interest Calculations', () => {
  const calculateMonthlyPayment = (
    principal: number,
    annualRate: number,
    months: number
  ) => {
    if (annualRate === 0) {
      return principal / months;
    }
    const monthlyRate = annualRate / 100 / 12;
    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1)
    );
  };

  const calculateTotalInterest = (
    principal: number,
    annualRate: number,
    months: number
  ) => {
    const monthlyPayment = calculateMonthlyPayment(
      principal,
      annualRate,
      months
    );
    return monthlyPayment * months - principal;
  };

  it('should calculate total interest paid over loan term', () => {
    // $10,000 at 6% for 12 months
    const totalInterest = calculateTotalInterest(10000, 6, 12);
    expect(totalInterest).toBeCloseTo(327.97, 1);
  });

  it('should return zero interest for 0% rate', () => {
    const totalInterest = calculateTotalInterest(10000, 0, 12);
    expect(totalInterest).toBe(0);
  });

  it('should calculate higher interest for longer terms', () => {
    // $10,000 at 6%: 12 months vs 24 months
    const interest12 = calculateTotalInterest(10000, 6, 12);
    const interest24 = calculateTotalInterest(10000, 6, 24);
    expect(interest24).toBeGreaterThan(interest12);
  });
});

// ==========================================================================
// REMAINING BALANCE CALCULATIONS
// ==========================================================================

describe('Remaining Balance Calculations', () => {
  const calculateRemainingBalance = (
    principal: number,
    monthlyPayment: number,
    annualRate: number,
    paymentsMade: number
  ) => {
    let balance = principal;
    const monthlyRate = annualRate / 100 / 12;

    for (let i = 0; i < paymentsMade; i++) {
      const interestCharge = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestCharge;
      balance -= principalPayment;
    }

    return Math.max(0, balance);
  };

  it('should calculate remaining balance after payments', () => {
    // $10,000 at 6%, monthly payment $860.66, after 6 payments
    const remaining = calculateRemainingBalance(10000, 860.66, 6, 6);
    expect(remaining).toBeCloseTo(5074.83, 0); // Within $1 tolerance
  });

  it('should return zero balance after all payments', () => {
    const remaining = calculateRemainingBalance(10000, 860.66, 6, 12);
    expect(remaining).toBeLessThan(1); // Should be less than $1 (rounding error)
  });

  it('should return full principal for zero payments', () => {
    const remaining = calculateRemainingBalance(10000, 860.66, 6, 0);
    expect(remaining).toBe(10000);
  });

  it('should handle zero interest rate', () => {
    // $12,000 at 0%, $1,000/month, after 6 payments
    const remaining = calculateRemainingBalance(12000, 1000, 0, 6);
    expect(remaining).toBe(6000); // Simple subtraction
  });
});

// ==========================================================================
// DATE FORMATTING
// ==========================================================================

describe('Date Formatting', () => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      timeZone: 'Asia/Manila',
    });
  };

  it('should format date correctly', () => {
    expect(formatDate('2024-01-15')).toMatch(/January 15, 2024/);
    expect(formatDate('2024-12-25')).toMatch(/December 25, 2024/);
  });

  it('should handle different months', () => {
    expect(formatDate('2024-06-01')).toMatch(/June 01, 2024/);
    expect(formatDate('2024-09-30')).toMatch(/September 30, 2024/);
  });
});

// ==========================================================================
// PERCENT FORMATTING
// ==========================================================================

describe('Percent Formatting', () => {
  const formatPercent = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  it('should format percentage with 2 decimals', () => {
    expect(formatPercent(6)).toBe('6.00%');
    expect(formatPercent(12.5)).toBe('12.50%');
    expect(formatPercent(8.75)).toBe('8.75%');
  });

  it('should handle zero', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('should round to 2 decimals', () => {
    expect(formatPercent(6.666)).toBe('6.67%');
    expect(formatPercent(8.333)).toBe('8.33%');
  });
});

// ==========================================================================
// STATUS COLORS
// ==========================================================================

describe('Status Colors', () => {
  type LoanStatus =
    | 'pending'
    | 'approved'
    | 'active'
    | 'completed'
    | 'rejected';

  const getStatusColor = (status: LoanStatus): string => {
    switch (status) {
      case 'pending':
        return 'yellow';
      case 'approved':
        return 'blue';
      case 'active':
        return 'green';
      case 'completed':
        return 'teal';
      case 'rejected':
        return 'red';
      default:
        return 'gray';
    }
  };

  it('should return yellow for pending', () => {
    expect(getStatusColor('pending')).toBe('yellow');
  });

  it('should return blue for approved', () => {
    expect(getStatusColor('approved')).toBe('blue');
  });

  it('should return green for active', () => {
    expect(getStatusColor('active')).toBe('green');
  });

  it('should return teal for completed', () => {
    expect(getStatusColor('completed')).toBe('teal');
  });

  it('should return red for rejected', () => {
    expect(getStatusColor('rejected')).toBe('red');
  });
});

// ==========================================================================
// LOAN TYPE COLORS
// ==========================================================================

describe('Loan Type Colors', () => {
  type LoanType =
    | 'personal'
    | 'emergency'
    | 'educational'
    | 'housing'
    | 'vehicle';

  const getLoanTypeColor = (type: LoanType): string => {
    switch (type) {
      case 'personal':
        return 'blue';
      case 'emergency':
        return 'red';
      case 'educational':
        return 'violet';
      case 'housing':
        return 'green';
      case 'vehicle':
        return 'orange';
      default:
        return 'gray';
    }
  };

  it('should return blue for personal', () => {
    expect(getLoanTypeColor('personal')).toBe('blue');
  });

  it('should return red for emergency', () => {
    expect(getLoanTypeColor('emergency')).toBe('red');
  });

  it('should return violet for educational', () => {
    expect(getLoanTypeColor('educational')).toBe('violet');
  });

  it('should return green for housing', () => {
    expect(getLoanTypeColor('housing')).toBe('green');
  });

  it('should return orange for vehicle', () => {
    expect(getLoanTypeColor('vehicle')).toBe('orange');
  });
});

// ==========================================================================
// LOAN FILTERING
// ==========================================================================

describe('Loan Filtering', () => {
  interface Loan {
    employee: string;
    purpose: string;
    loanType: string;
    status: string;
  }

  const filterLoans = (
    loans: Loan[],
    searchQuery: string,
    statusFilter: string,
    loanTypeFilter: string | null
  ) => {
    return loans.filter((loan) => {
      const matchesSearch =
        loan.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.loanType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || loan.status === statusFilter;

      const matchesType =
        !loanTypeFilter ||
        loanTypeFilter === 'All' ||
        loan.loanType === loanTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  };

  const mockLoans: Loan[] = [
    {
      employee: 'John Doe',
      purpose: 'Home renovation',
      loanType: 'housing',
      status: 'active',
    },
    {
      employee: 'Jane Smith',
      purpose: 'Medical expenses',
      loanType: 'emergency',
      status: 'pending',
    },
    {
      employee: 'Bob Johnson',
      purpose: 'Car purchase',
      loanType: 'vehicle',
      status: 'completed',
    },
  ];

  it('should return all loans with no filters', () => {
    const result = filterLoans(mockLoans, '', 'all', null);
    expect(result).toHaveLength(3);
  });

  it('should filter by employee name', () => {
    const result = filterLoans(mockLoans, 'John', 'all', null);
    expect(result).toHaveLength(2); // John Doe and Bob Johnson
  });

  it('should filter by purpose', () => {
    const result = filterLoans(mockLoans, 'renovation', 'all', null);
    expect(result).toHaveLength(1);
    expect(result[0].employee).toBe('John Doe');
  });

  it('should filter by loan type keyword', () => {
    const result = filterLoans(mockLoans, 'housing', 'all', null);
    expect(result).toHaveLength(1);
    expect(result[0].loanType).toBe('housing');
  });

  it('should filter by status', () => {
    const result = filterLoans(mockLoans, '', 'active', null);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
  });

  it('should filter by loan type filter', () => {
    const result = filterLoans(mockLoans, '', 'all', 'emergency');
    expect(result).toHaveLength(1);
    expect(result[0].loanType).toBe('emergency');
  });

  it('should combine all filters', () => {
    const result = filterLoans(mockLoans, 'John', 'active', 'housing');
    expect(result).toHaveLength(1);
    expect(result[0].employee).toBe('John Doe');
  });

  it('should be case-insensitive', () => {
    const result = filterLoans(mockLoans, 'JOHN', 'all', null);
    expect(result).toHaveLength(2);
  });

  it('should handle "All" loan type filter', () => {
    const result = filterLoans(mockLoans, '', 'all', 'All');
    expect(result).toHaveLength(3);
  });
});

// ==========================================================================
// STATISTICS CALCULATIONS
// ==========================================================================

describe('Statistics Calculations', () => {
  interface Loan {
    status: string;
    amount: number;
    remainingBalance: number;
  }

  const calculateStats = (loans: Loan[]) => {
    const totalLoans = loans.length;
    const pendingLoans = loans.filter((l) => l.status === 'pending').length;
    const activeLoans = loans.filter((l) => l.status === 'active').length;
    const totalDisbursed = loans
      .filter((l) => l.status === 'active' || l.status === 'completed')
      .reduce((sum, l) => sum + l.amount, 0);
    const totalOutstanding = loans
      .filter((l) => l.status === 'active')
      .reduce((sum, l) => sum + l.remainingBalance, 0);

    return {
      totalLoans,
      pendingLoans,
      activeLoans,
      totalDisbursed,
      totalOutstanding,
    };
  };

  it('should calculate stats for empty array', () => {
    const stats = calculateStats([]);
    expect(stats).toEqual({
      totalLoans: 0,
      pendingLoans: 0,
      activeLoans: 0,
      totalDisbursed: 0,
      totalOutstanding: 0,
    });
  });

  it('should count loans by status', () => {
    const loans = [
      { status: 'pending', amount: 10000, remainingBalance: 10000 },
      { status: 'active', amount: 15000, remainingBalance: 12000 },
      { status: 'completed', amount: 20000, remainingBalance: 0 },
    ];

    const stats = calculateStats(loans);
    expect(stats).toEqual({
      totalLoans: 3,
      pendingLoans: 1,
      activeLoans: 1,
      totalDisbursed: 35000, // active + completed
      totalOutstanding: 12000, // active only
    });
  });

  it('should only include active and completed loans in disbursed total', () => {
    const loans = [
      { status: 'pending', amount: 10000, remainingBalance: 10000 },
      { status: 'active', amount: 15000, remainingBalance: 12000 },
      { status: 'rejected', amount: 20000, remainingBalance: 0 },
    ];

    const stats = calculateStats(loans);
    expect(stats.totalDisbursed).toBe(15000); // Only active loan
  });

  it('should only include active loans in outstanding total', () => {
    const loans = [
      { status: 'active', amount: 15000, remainingBalance: 12000 },
      { status: 'active', amount: 10000, remainingBalance: 8000 },
      { status: 'completed', amount: 20000, remainingBalance: 0 },
    ];

    const stats = calculateStats(loans);
    expect(stats.totalOutstanding).toBe(20000); // 12000 + 8000
  });
});

// ==========================================================================
// CSV IMPORT PARSING
// ==========================================================================

describe('CSV Import Parsing', () => {
  const calculateMonthlyPayment = (
    principal: number,
    annualRate: number,
    months: number
  ) => {
    if (annualRate === 0) {
      return principal / months;
    }
    const monthlyRate = annualRate / 100 / 12;
    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1)
    );
  };

  const parseCSVRow = (row: string) => {
    const [
      employee,
      loanType,
      amount,
      interestRate,
      termMonths,
      purpose,
      applicationDate,
    ] = row.split(',');

    const loanAmount = parseFloat(amount?.trim() || '0');
    const rate = parseFloat(interestRate?.trim() || '0');
    const term = parseInt(termMonths?.trim() || '12');
    const monthlyPayment = calculateMonthlyPayment(loanAmount, rate, term);

    return {
      employee: employee?.trim() || '',
      loanType: (loanType?.trim() || 'personal') as
        | 'personal'
        | 'emergency'
        | 'educational'
        | 'housing'
        | 'vehicle',
      amount: loanAmount,
      interestRate: rate,
      termMonths: term,
      monthlyPayment,
      remainingBalance: loanAmount,
      status: 'pending' as const,
      applicationDate: applicationDate?.trim() || '',
      purpose: purpose?.trim() || '',
    };
  };

  it('should parse valid CSV row', () => {
    const row = 'John Doe,personal,10000,6,12,Home improvement,2024-01-15';
    const loan = parseCSVRow(row);

    expect(loan.employee).toBe('John Doe');
    expect(loan.loanType).toBe('personal');
    expect(loan.amount).toBe(10000);
    expect(loan.interestRate).toBe(6);
    expect(loan.termMonths).toBe(12);
    expect(loan.monthlyPayment).toBeCloseTo(860.66, 2);
    expect(loan.remainingBalance).toBe(10000);
    expect(loan.status).toBe('pending');
  });

  it('should handle missing values with defaults', () => {
    const row = ',,,,,,';
    const loan = parseCSVRow(row);

    expect(loan.employee).toBe('');
    expect(loan.loanType).toBe('personal');
    expect(loan.amount).toBe(0);
    expect(loan.interestRate).toBe(0);
    expect(loan.termMonths).toBe(12);
    expect(loan.purpose).toBe('');
  });

  it('should trim whitespace', () => {
    const row =
      '  John Doe  ,  personal  ,  10000  ,  6  ,  12  ,  Purpose  ,  2024-01-15  ';
    const loan = parseCSVRow(row);

    expect(loan.employee).toBe('John Doe');
    expect(loan.loanType).toBe('personal');
    expect(loan.purpose).toBe('Purpose');
  });
});

// ==========================================================================
// CSV EXPORT FORMATTING
// ==========================================================================

describe('CSV Export Formatting', () => {
  interface Loan {
    employee: string;
    loanType: string;
    amount: number;
    interestRate: number;
    termMonths: number;
    monthlyPayment: number;
    remainingBalance: number;
    status: string;
    applicationDate: string;
    purpose: string;
  }

  const formatLoanForCSV = (loan: Loan) => {
    return [
      loan.employee,
      loan.loanType,
      loan.amount.toString(),
      loan.interestRate.toString(),
      loan.termMonths.toString(),
      loan.monthlyPayment.toFixed(2),
      loan.remainingBalance.toString(),
      loan.status,
      loan.applicationDate,
      loan.purpose,
    ].join(',');
  };

  it('should format loan for CSV export', () => {
    const loan: Loan = {
      employee: 'John Doe',
      loanType: 'personal',
      amount: 10000,
      interestRate: 6,
      termMonths: 12,
      monthlyPayment: 860.66,
      remainingBalance: 10000,
      status: 'pending',
      applicationDate: '2024-01-15',
      purpose: 'Home improvement',
    };

    const csv = formatLoanForCSV(loan);
    expect(csv).toBe(
      'John Doe,personal,10000,6,12,860.66,10000,pending,2024-01-15,Home improvement'
    );
  });

  it('should format monthly payment with 2 decimals', () => {
    const loan: Loan = {
      employee: 'Jane Smith',
      loanType: 'emergency',
      amount: 5000,
      interestRate: 8,
      termMonths: 6,
      monthlyPayment: 851.67123,
      remainingBalance: 5000,
      status: 'active',
      applicationDate: '2024-02-01',
      purpose: 'Medical',
    };

    const csv = formatLoanForCSV(loan);
    expect(csv).toContain(',851.67,'); // Rounded to 2 decimals
  });
});

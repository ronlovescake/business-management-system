import { getCurrentDateISO } from '@/utils/date';
import { FormatterService } from '@/services/FormatterService';
import type { EmployeeLoan } from '../types';

export const formatLoanDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatLoanCurrency = (amount: number) =>
  FormatterService.formatCurrency(amount);

export const formatLoanPercent = (rate: number) => {
  return `${rate.toFixed(2)}%`;
};

export const getLoanStatusColor = (status: EmployeeLoan['status']) => {
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

export const getLoanTypeColor = (type: EmployeeLoan['loanType']) => {
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

export const calculateLoanMonthlyPayment = (
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

export const createImportedLoanRecord = (
  row: string,
  prefix = ''
): EmployeeLoan => {
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
  const monthlyPayment = calculateLoanMonthlyPayment(loanAmount, rate, term);

  return {
    id: `${prefix}${Date.now().toString()}${Math.random()}`,
    employee: employee?.trim() || '',
    loanType: (loanType?.trim() || 'personal') as EmployeeLoan['loanType'],
    amount: loanAmount,
    interestRate: rate,
    termMonths: term,
    monthlyPayment,
    remainingBalance: loanAmount,
    status: 'pending',
    applicationDate: applicationDate?.trim() || getCurrentDateISO(),
    purpose: purpose?.trim() || '',
  };
};

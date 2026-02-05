export type PayrollStatus = 'pending' | 'approved' | 'paid';

export function formatPayrollDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatPayrollCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
}

export function getPayrollStatusColor(status: PayrollStatus) {
  switch (status) {
    case 'pending':
      return 'orange';
    case 'approved':
      return 'green';
    case 'paid':
      return 'blue';
    default:
      return 'gray';
  }
}

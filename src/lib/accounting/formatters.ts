import { formatDateOnly } from '@/utils/dateFormatters';

export type CurrencyFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatCurrencyPHP(
  amount: number,
  options: CurrencyFormatOptions = {}
): string {
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

export function formatLongDateUS(date: string | Date): string {
  return formatDateOnly(date);
}

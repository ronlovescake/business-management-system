import { useThirteenthMonthPay as useThirteenthMonthPayBase } from '@/app/clothing/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay';

export function useThirteenthMonthPay() {
  return useThirteenthMonthPayBase('/api/trucking');
}

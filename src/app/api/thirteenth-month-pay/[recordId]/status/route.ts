import { thirteenthMonthPayService } from '@/modules/clothing/employees/thirteenth-month-pay/api';
import { createThirteenthMonthPayStatusRoute } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';

const { PATCH } = createThirteenthMonthPayStatusRoute(
  thirteenthMonthPayService
);

export { PATCH };

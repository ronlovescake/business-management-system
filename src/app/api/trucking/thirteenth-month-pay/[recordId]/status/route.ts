import { thirteenthMonthPayService } from '@/modules/trucking/employees/thirteenth-month-pay/api';
import { createThirteenthMonthPayStatusRoute } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';

const { PATCH } = createThirteenthMonthPayStatusRoute(
  thirteenthMonthPayService
);

export { PATCH };

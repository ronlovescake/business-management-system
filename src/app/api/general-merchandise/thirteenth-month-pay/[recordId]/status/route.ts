import { generalMerchandiseThirteenthMonthPayService } from '../../serviceAdapter';
import { createThirteenthMonthPayStatusRoute } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';

const { PATCH } = createThirteenthMonthPayStatusRoute(
  generalMerchandiseThirteenthMonthPayService
);

export { PATCH };

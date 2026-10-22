import { generalMerchandiseThirteenthMonthPayService } from './serviceAdapter';
import { createThirteenthMonthPayRoutes } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';
import { getCalculatedThirteenthMonthPayRecords } from './calculatedRecords';

const { GET, PATCH } = createThirteenthMonthPayRoutes(
  generalMerchandiseThirteenthMonthPayService,
  { calculateRecords: getCalculatedThirteenthMonthPayRecords }
);

export { GET, PATCH };

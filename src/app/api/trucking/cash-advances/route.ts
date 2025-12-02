import { createCashAdvanceRoutes } from '@/modules/employees/cash-advance/api/routeFactory';
import {
  cashAdvanceService,
  CashAdvanceQuerySchema,
  CashAdvanceCreateSchema,
  CashAdvanceUpdateSchema,
} from '@/modules/trucking/employees/cash-advance/api';

const { GET, POST, PUT, DELETE } = createCashAdvanceRoutes({
  service: cashAdvanceService,
  schemas: {
    query: CashAdvanceQuerySchema,
    create: CashAdvanceCreateSchema,
    update: CashAdvanceUpdateSchema,
  },
  loggerScope: 'Trucking cash advance',
});

export { GET, POST, PUT, DELETE };

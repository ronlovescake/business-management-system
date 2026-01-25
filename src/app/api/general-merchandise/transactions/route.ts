import { createTransactionRoutes } from '@/modules/transactions/api/routeFactory';
import { generalMerchandiseTransactionService } from '@/modules/general-merchandise/transactions/api/service';

const { GET, POST, PUT, PATCH, DELETE } = createTransactionRoutes({
  service: generalMerchandiseTransactionService,
  loggerScope: 'GeneralMerchandiseTransactions',
});

export { GET, POST, PUT, PATCH, DELETE };

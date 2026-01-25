import { createCustomerRoutes } from '@/modules/customers/api/routeFactory';
import { generalMerchandiseCustomerService } from '@/modules/general-merchandise/customers/api/service';

const { GET, PUT, POST, DELETE } = createCustomerRoutes({
  service: generalMerchandiseCustomerService,
  loggerScope: 'GeneralMerchandiseCustomers',
});

export { GET, PUT, POST, DELETE };

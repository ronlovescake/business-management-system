import { createProductRoutes } from '@/modules/products/api/routeFactory';
import { generalMerchandiseProductService } from '@/modules/general-merchandise/products/api/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const { GET, POST, PUT, DELETE } = createProductRoutes({
  service: generalMerchandiseProductService,
  loggerScope: 'GeneralMerchandiseProducts',
});

export { GET, POST, PUT, DELETE };

import { prisma } from '@/lib/db';
import { createInvoiceRoutes } from '@/modules/invoices/api/invoiceRouteFactory';

const { GET, POST, PUT, DELETE } = createInvoiceRoutes({
  invoiceModel: prisma.generalMerchandiseInvoice,
  domainLabel: 'GM',
});

export { GET, POST, PUT, DELETE };

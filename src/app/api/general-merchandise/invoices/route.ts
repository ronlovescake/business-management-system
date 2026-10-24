import { prisma } from '@/lib/db';
import { createInvoiceRoutes } from '@/modules/invoices/api/invoiceRouteFactory';

const { GET, POST, PUT, DELETE } = createInvoiceRoutes({
  invoiceModel: prisma.generalMerchandiseInvoice,
  withTransaction: (operation) =>
    prisma.$transaction((tx) => operation(tx.generalMerchandiseInvoice), {
      isolationLevel: 'Serializable',
    }),
  domainLabel: 'GM',
});

export { GET, POST, PUT, DELETE };

import { prisma } from '@/lib/db';
import { createInvoiceRoutes } from '@/modules/invoices/api/invoiceRouteFactory';

const { GET, POST, PUT, DELETE } = createInvoiceRoutes({
  invoiceModel: prisma.invoice,
  withTransaction: (operation) =>
    prisma.$transaction((tx) => operation(tx.invoice), {
      isolationLevel: 'Serializable',
    }),
});

export { GET, POST, PUT, DELETE };

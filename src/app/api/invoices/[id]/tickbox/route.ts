import { prisma } from '@/lib/db';
import { createTickboxRoute } from '@/modules/invoices/api/invoiceRouteFactory';

const { PUT } = createTickboxRoute(prisma.invoice);

export { PUT };

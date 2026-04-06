import { calculateInvoiceWeights } from '../_lib/weightCalculation';
import { createCalculateWeightsRoute } from '@/modules/invoices/api/invoiceRouteFactory';

const { GET, POST } = createCalculateWeightsRoute(calculateInvoiceWeights);

export { GET, POST };

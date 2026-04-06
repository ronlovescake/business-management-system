import { calculateInvoiceWeights } from '../_lib/weightCalculation';
import { createCalculateWeightsRoute } from '@/modules/invoices/api/invoiceRouteFactory';

const { GET, POST } = createCalculateWeightsRoute(
  calculateInvoiceWeights,
  'GM'
);

export { GET, POST };

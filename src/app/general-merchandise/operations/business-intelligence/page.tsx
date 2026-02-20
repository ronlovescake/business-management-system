import { BusinessIntelligenceRoutePage } from '@/app/operations/business-intelligence/_shared/BusinessIntelligenceRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function BusinessIntelligencePage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/business-intelligence',
    <BusinessIntelligenceRoutePage apiBasePath="/api/general-merchandise" />
  );
}

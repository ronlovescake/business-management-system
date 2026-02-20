import { BusinessIntelligenceRoutePage } from '@/app/operations/business-intelligence/_shared/BusinessIntelligenceRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function BusinessIntelligencePage() {
  return renderOperationsPage(
    '/clothing/operations/business-intelligence',
    <BusinessIntelligenceRoutePage />
  );
}

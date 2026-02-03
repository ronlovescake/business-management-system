import { PageLayout } from '@/components/layout/PageLayout';
import { DueDatesPage } from '@/modules/clothing/operations/due-dates/components/DueDatesPage';
import { DueDatesErrorBoundary } from '@/app/clothing/operations/due-dates/components/DueDatesErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function GeneralMerchandiseDueDatesPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/due-dates',
    <PageLayout fluid withPadding>
      <DueDatesErrorBoundary>
        <DueDatesPage apiBasePath="/api/general-merchandise" />
      </DueDatesErrorBoundary>
    </PageLayout>
  );
}

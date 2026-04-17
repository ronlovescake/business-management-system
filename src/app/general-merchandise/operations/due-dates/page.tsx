import { PageLayout } from '@/components/layout/PageLayout';
import { DueDatesPage } from '@/modules/clothing/operations/due-dates/components/DueDatesPage';
import { DueDatesErrorBoundary } from '@/app/clothing/operations/due-dates/components/DueDatesErrorBoundary';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseDueDatesPage() {
  return renderOperationsPage(
    '/general-merchandise/operations/due-dates',
    <PageLayout fluid withPadding>
      <DueDatesErrorBoundary>
        <DueDatesPage apiBasePath="/api/general-merchandise" />
      </DueDatesErrorBoundary>
    </PageLayout>
  );
}

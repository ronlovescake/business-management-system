import { PageLayout } from '@/components/layout/PageLayout';
import { PostTemplateErrorBoundary } from '@/app/clothing/operations/post-template/components/PostTemplateErrorBoundary';
import { PostTemplateComponent } from '@/modules/clothing/operations/post-template/components/PostTemplateComponent';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function PostTemplate() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/post-template',
    <PageLayout title="Post Template">
      <PostTemplateErrorBoundary>
        <PostTemplateComponent apiBasePath="/api/general-merchandise" />
      </PostTemplateErrorBoundary>
    </PageLayout>
  );
}

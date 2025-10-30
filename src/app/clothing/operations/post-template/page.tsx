import { PageLayout } from '../../../../components/layout/PageLayout';
import { PostTemplateErrorBoundary } from './components/PostTemplateErrorBoundary';
import { PostTemplateComponent } from '@/modules/clothing/operations/post-template/components/PostTemplateComponent';

export default function PostTemplate() {
  return (
    <PageLayout title="Post Template">
      <PostTemplateErrorBoundary>
        <PostTemplateComponent />
      </PostTemplateErrorBoundary>
    </PageLayout>
  );
}

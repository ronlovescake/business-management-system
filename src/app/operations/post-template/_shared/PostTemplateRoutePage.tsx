import { PageLayout } from '@/components/layout/PageLayout';
import { PostTemplateErrorBoundary } from '@/app/clothing/operations/post-template/components/PostTemplateErrorBoundary';
import { PostTemplateComponent } from '@/modules/clothing/operations/post-template/components/PostTemplateComponent';

type PostTemplateRoutePageProps = {
  apiBasePath?: string;
};

export function PostTemplateRoutePage(props: PostTemplateRoutePageProps) {
  const { apiBasePath } = props;

  return (
    <PageLayout title="Post Template">
      <PostTemplateErrorBoundary>
        <PostTemplateComponent apiBasePath={apiBasePath} />
      </PostTemplateErrorBoundary>
    </PageLayout>
  );
}

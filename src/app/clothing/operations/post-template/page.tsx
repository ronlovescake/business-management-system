import { PageLayout } from '../../../../components/layout/PageLayout';
import { PostTemplateErrorBoundary } from './components/PostTemplateErrorBoundary';
import { PostTemplateComponent } from '@/modules/clothing/operations/post-template/components/PostTemplateComponent';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function PostTemplate() {
  const hasAccess = await hasModuleAccess('/clothing/operations/post-template');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout title="Post Template">
        <PostTemplateErrorBoundary>
          <PostTemplateComponent />
        </PostTemplateErrorBoundary>
      </PageLayout>
    </PermissionGuard>
  );
}

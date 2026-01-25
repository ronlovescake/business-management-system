import { PageLayout } from '@/components/layout/PageLayout';
import { PostTemplateErrorBoundary } from '@/app/clothing/operations/post-template/components/PostTemplateErrorBoundary';
import { PostTemplateComponent } from '@/modules/clothing/operations/post-template/components/PostTemplateComponent';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function PostTemplate() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/post-template'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout title="Post Template">
        <PostTemplateErrorBoundary>
          <PostTemplateComponent apiBasePath="/api/general-merchandise" />
        </PostTemplateErrorBoundary>
      </PageLayout>
    </PermissionGuard>
  );
}

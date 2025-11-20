import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { PageLayout } from '@/components/layout/PageLayout';
import { MessageTemplatesBoard } from './MessageTemplatesBoard';
import {
  getFirstAccessibleModule,
  hasModuleAccess,
} from '@/lib/auth/permissions';
import { DEFAULT_MESSAGE_TEMPLATES } from '@/modules/clothing/operations/message-templates/templates.data';

export default async function MessageTemplatesPage() {
  const modulePath = '/clothing/operations/message-templates';
  const hasAccess = await hasModuleAccess(modulePath);
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout title="Message Templates" size="xl">
        <MessageTemplatesBoard templates={DEFAULT_MESSAGE_TEMPLATES} />
      </PageLayout>
    </PermissionGuard>
  );
}

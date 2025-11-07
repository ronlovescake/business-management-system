/**
 * Due Dates Page - Route Handler
 *
 * This file now simply exports the modular component.
 * All business logic has been moved to the module structure.
 * Direct import path used to optimize compilation speed.
 *
 * ✅ UI is IDENTICAL - only code organization changed!
 */

import { Container } from '@mantine/core';
import { DueDatesPage } from '@/modules/clothing/operations/due-dates/components/DueDatesPage';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function Page() {
  const hasAccess = await hasModuleAccess('/clothing/operations/due-dates');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <Container size="xl" fluid p="md">
        <DueDatesPage />
      </Container>
    </PermissionGuard>
  );
}

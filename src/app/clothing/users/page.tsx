'use client';

import { Container } from '@mantine/core';
import { UserManagementPanel } from '@/modules/shared/user-management/UserManagementPanel';

export default function UserManagementPage() {
  return (
    <Container size="xl" py="xl">
      <UserManagementPanel />
    </Container>
  );
}

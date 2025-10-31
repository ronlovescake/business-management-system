/**
 * Dispatching Page
 * Manage dispatching operations
 */

import type { Metadata } from 'next';
import { Container } from '@mantine/core';
import { DispatchingComponent } from '@/modules/clothing/operations/dispatching';

export const metadata: Metadata = {
  title: 'Dispatching - Business Management',
  description: 'Manage dispatching operations and tracking',
};

export default function DispatchingPage() {
  return (
    <Container size="xl" fluid p="md">
      <DispatchingComponent />
    </Container>
  );
}

/**
 * Dispatch Page
 * Manage dispatch operations and order tracking
 */

import type { Metadata } from 'next';
import { Container } from '@mantine/core';
import { DispatchComponent } from '@/modules/clothing/operations/dispatch';

export const metadata: Metadata = {
  title: 'Dispatch - Business Management',
  description: 'Manage dispatch operations and order tracking',
};

export default function DispatchPage() {
  return (
    <Container size="xl" fluid p="md">
      <DispatchComponent />
    </Container>
  );
}

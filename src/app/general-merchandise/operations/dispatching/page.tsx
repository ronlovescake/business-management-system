import type { Metadata } from 'next';
import { Container } from '@mantine/core';
import { DispatchingComponent } from '@/modules/clothing/operations/dispatching';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export const metadata: Metadata = {
  title: 'Dispatching - General Merchandise',
  description: 'Manage dispatching operations and tracking',
};

export default async function GeneralMerchandiseDispatchingPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/dispatching',
    <Container size="xl" fluid p="md">
      <DispatchingComponent />
    </Container>
  );
}

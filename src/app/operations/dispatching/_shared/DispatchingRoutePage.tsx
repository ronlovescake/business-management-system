import { Container } from '@mantine/core';
import { DispatchingComponent } from '@/modules/clothing/operations/dispatching';

export function DispatchingRoutePage() {
  return (
    <Container size="xl" fluid p="md">
      <DispatchingComponent />
    </Container>
  );
}

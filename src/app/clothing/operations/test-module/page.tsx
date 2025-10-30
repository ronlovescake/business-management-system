/**
 * Test Module Page
 * Testing the StandardTableControls reusable template
 */

import type { Metadata } from 'next';
import { Container } from '@mantine/core';
import { TestModuleComponent } from '@/modules/clothing/operations/test-module';

export const metadata: Metadata = {
  title: 'Test Module - Business Management',
  description: 'Testing the reusable table template with all standard features',
};

export default function TestModulePage() {
  return (
    <Container size="xl" fluid p="md">
      <TestModuleComponent />
    </Container>
  );
}

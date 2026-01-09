'use client';

import type { ReactNode } from 'react';
import { Stack, Title, Text, Card } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';

interface PersonalPageShellProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PersonalPageShell({
  title,
  description,
  children,
}: PersonalPageShellProps) {
  return (
    <PageLayout fluid withPadding>
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2}>{title}</Title>
          {description ? (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
        {children ?? (
          <Card withBorder padding="md" radius="md">
            <Text size="sm" c="dimmed">
              Content coming soon.
            </Text>
          </Card>
        )}
      </Stack>
    </PageLayout>
  );
}

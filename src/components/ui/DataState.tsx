import React from 'react';
import { Card, Text, Stack, Loader, Alert, Center } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface DataStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children?: React.ReactNode;
}

export function DataState({ 
  loading, 
  error, 
  empty, 
  emptyMessage = 'No data available',
  children 
}: DataStateProps) {
  if (loading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        {error}
      </Alert>
    );
  }

  if (empty) {
    return (
      <Center py="xl">
        <Text c="dimmed">{emptyMessage}</Text>
      </Center>
    );
  }

  return <>{children}</>;
}
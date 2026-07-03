import React from 'react';
import { Text } from '@mantine/core';

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <Text size="sm" c="dimmed" ta="center">
        {message}
      </Text>
    </div>
  );
}

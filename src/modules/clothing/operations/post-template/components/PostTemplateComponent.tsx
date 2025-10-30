/**
 * Post Template Component
 * Main component for managing social media post templates
 */

'use client';

import { useState } from 'react';
import { Stack, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

export function PostTemplateComponent() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <Stack gap="md">
      <TextInput
        placeholder="Search post templates..."
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
        size="md"
        styles={{
          input: {
            '&:focus': {
              borderColor: 'var(--mantine-color-blue-6)',
            },
          },
        }}
      />
    </Stack>
  );
}

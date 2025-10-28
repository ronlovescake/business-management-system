import { memo } from 'react';
import { Card, Stack, Title, Group, Text, ThemeIcon } from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconBuildingStore,
} from '@tabler/icons-react';
import type { CustomerData } from '../types';

// ============================================================================
// CUSTOMER INFO CARD
// ============================================================================

interface CustomerInfoCardProps {
  customer: CustomerData;
}

export const CustomerInfoCard = memo(function CustomerInfoCard({ customer }: CustomerInfoCardProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="sm">
        <Title order={4}>Customer Information</Title>

        <Group>
          <ThemeIcon variant="light" size="sm">
            <IconUser size={14} />
          </ThemeIcon>
          <div>
            <Text size="xs" c="dimmed">
              Name
            </Text>
            <Text size="sm">{customer['Customer Name']}</Text>
          </div>
        </Group>

        {customer['Phone Number'] && (
          <Group>
            <ThemeIcon variant="light" size="sm">
              <IconPhone size={14} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Phone
              </Text>
              <Text size="sm">{customer['Phone Number']}</Text>
            </div>
          </Group>
        )}

        {customer['Email Address'] && (
          <Group>
            <ThemeIcon variant="light" size="sm">
              <IconMail size={14} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Email
              </Text>
              <Text size="sm">{customer['Email Address']}</Text>
            </div>
          </Group>
        )}

        {customer.Address && (
          <Group>
            <ThemeIcon variant="light" size="sm">
              <IconMapPin size={14} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Address
              </Text>
              <Text size="sm">{customer.Address}</Text>
            </div>
          </Group>
        )}

        {customer['Business Name'] && (
          <Group>
            <ThemeIcon variant="light" size="sm">
              <IconBuildingStore size={14} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Business
              </Text>
              <Text size="sm">{customer['Business Name']}</Text>
            </div>
          </Group>
        )}
      </Stack>
    </Card>
  );
});

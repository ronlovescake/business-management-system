import {
  Badge,
  Card,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconShirt } from '@tabler/icons-react';
import type { RecentActivity } from '../../types/dashboard.types';

interface RecentActivityCardProps {
  activities: RecentActivity[];
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      className="modern-card"
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Recent Activity</Title>
            <Text size="sm" c="dimmed">
              Timeline across orders, inventory, and comms.
            </Text>
          </div>
          <Badge variant="light" color="violet">
            Live feed
          </Badge>
        </Group>
        <Divider />
        <ScrollArea h={260} offsetScrollbars>
          <Stack gap="sm">
            {activities.map((activity) => (
              <Card
                key={`${activity.time}-${activity.action}`}
                padding="md"
                radius="md"
                withBorder
                className="modern-card"
              >
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon
                      size="sm"
                      radius="md"
                      variant="light"
                      color={activity.color}
                    >
                      <IconShirt size={12} />
                    </ThemeIcon>
                    <Text size="sm">{activity.action}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {activity.time}
                  </Text>
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Card>
  );
}

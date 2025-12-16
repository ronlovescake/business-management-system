'use client';

import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconArrowRight,
  IconDashboard,
  IconSettings,
  IconShirt,
  IconTruck,
} from '@tabler/icons-react';
import { PageLayout } from '@/components/layout/PageLayout';

const dashboardLinks = [
  {
    title: 'Clothing · Operations Dashboard',
    description:
      'Primary dashboard for clothing operations metrics and activity.',
    href: '/clothing/operations/dashboard',
    icon: <IconShirt size={16} />,
  },
  {
    title: 'Trucking · Employees Dashboard',
    description:
      'Employee-focused trucking dashboard (attendance, payroll, alerts).',
    href: '/trucking/employees/dashboard',
    icon: <IconTruck size={16} />,
  },
] as const;

const settingsLinks = [
  {
    title: 'Clothing · Operations Settings',
    description: 'Global settings for clothing operations modules.',
    href: '/clothing/operations/settings',
  },
  {
    title: 'Clothing · Employees Settings',
    description: 'Settings for clothing employee tools and workflows.',
    href: '/clothing/employees/settings',
  },
  {
    title: 'Trucking · Employees Settings',
    description: 'Settings for trucking employee tools and workflows.',
    href: '/trucking/employees/settings',
  },
  {
    title: 'Workspaces',
    description: 'Enable/disable modules and configure workspace access.',
    href: '/workspaces',
  },
  {
    title: 'Account Settings',
    description: 'Your personal profile and application-level preferences.',
    href: '/settings',
  },
] as const;

export default function AdminHomePage() {
  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>Admin</Title>
          <Text c="dimmed" size="sm">
            Master dashboard and settings across trucking and clothing.
          </Text>
        </Stack>

        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Group gap="xs" align="center">
                  <IconDashboard size={18} />
                  <Text fw={600}>Master Dashboard</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Jump into the key dashboards for each business line.
                </Text>
              </div>
              <Badge variant="light">Start here</Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {dashboardLinks.map((link) => (
                <Card key={link.href} withBorder padding="md" radius="md">
                  <Stack gap={6}>
                    <Group justify="space-between" align="center">
                      <Group gap="xs" align="center">
                        {link.icon}
                        <Text fw={600}>{link.title}</Text>
                      </Group>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {link.description}
                    </Text>
                    <Button
                      component={Link}
                      href={link.href}
                      variant="light"
                      rightSection={<IconArrowRight size={16} />}
                      maw={260}
                    >
                      Open
                    </Button>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Group gap="xs" align="center">
              <IconSettings size={18} />
              <Text fw={600}>Master Settings</Text>
            </Group>
            <Text size="sm" c="dimmed">
              Central shortcuts for module settings and system configuration.
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {settingsLinks.map((link) => (
                <Card key={link.href} withBorder padding="md" radius="md">
                  <Stack gap={6}>
                    <Text fw={600}>{link.title}</Text>
                    <Text size="sm" c="dimmed">
                      {link.description}
                    </Text>
                    <Button
                      component={Link}
                      href={link.href}
                      variant="subtle"
                      rightSection={<IconArrowRight size={16} />}
                      maw={260}
                    >
                      Open
                    </Button>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        </Card>
      </Stack>
    </PageLayout>
  );
}

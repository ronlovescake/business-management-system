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
import { IconArrowRight } from '@tabler/icons-react';
import { PageLayout } from '../../../components/layout/PageLayout';

const upcomingModules = [
  {
    title: 'Dispatch Center',
    description:
      'Coordinate loads, assign drivers, and monitor live trip status.',
  },
  {
    title: 'Fleet Readiness',
    description:
      'Track preventive maintenance, repairs, and compliance paperwork.',
  },
  {
    title: 'Customer Ops',
    description: 'Manage contracts, SLAs, and priority accounts in one place.',
  },
  {
    title: 'Billing & Collections',
    description:
      'Automate invoices, charge approvals, and proof-of-delivery sharing.',
  },
] as const;

export default function TruckingOperationsWorkspace() {
  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>Trucking Operations Workspace</Title>
          <Text c="dimmed" size="sm">
            A dedicated control room for dispatch, fleet, customer ops, and
            billing that mirrors the rigor of your clothing workspace.
          </Text>
        </Stack>

        <Card withBorder padding="lg" radius="md" shadow="sm">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={600} size="lg">
                  Workspace Status
                </Text>
                <Text size="sm" c="dimmed">
                  Foundation ready. Connect new modules or reuse existing
                  playbooks as you roll out trucking-specific operations tools.
                </Text>
              </div>
              <Badge color="blue" variant="light" size="lg">
                Ready
              </Badge>
            </Group>
            <Button
              component={Link}
              href="/workspaces"
              variant="light"
              rightSection={<IconArrowRight size={16} />}
              maw={240}
            >
              Configure Modules
            </Button>
          </Stack>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text fw={600}>Upcoming Modules</Text>
                <Text size="sm" c="dimmed">
                  Ship the trucking counterparts of dispatch, fleet, customer
                  ops, and billing.
                </Text>
              </div>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {upcomingModules.map((module) => (
                <Card
                  key={module.title}
                  withBorder
                  padding="md"
                  radius="md"
                  shadow="xs"
                >
                  <Stack gap={6}>
                    <Group justify="space-between">
                      <Text fw={600}>{module.title}</Text>
                      <Badge color="gray" variant="light">
                        Planned
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {module.description}
                    </Text>
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

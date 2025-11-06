'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import {
  Container,
  Text,
  Title,
  Stack,
  Card,
  Badge,
  Group,
  Button,
  Paper,
  ThemeIcon,
  SimpleGrid,
  Center,
  Box,
  Alert,
} from '@mantine/core';
import {
  IconBuilding,
  IconUsers,
  IconSettings,
  IconChartBar,
  IconTruck,
  IconShirt,
  IconArrowRight,
  IconDashboard,
  IconUserCheck,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useBusinessStore } from '../lib/store';
import { LogoutButton } from '@/components/auth/LogoutButton';

export default function HomePage() {
  const { selectedBusiness, selectedWorkspace } = useBusinessStore();
  const { data: session, status } = useSession();

  const businessFeatures = {
    clothing: [
      {
        icon: IconChartBar,
        title: 'Business Intelligence',
        description: 'Advanced analytics and reporting',
      },
      {
        icon: IconSettings,
        title: 'Inventory Management',
        description: 'Track products and stock levels',
      },
      {
        icon: IconUsers,
        title: 'Customer Management',
        description: 'Manage customer relationships',
      },
      {
        icon: IconTruck,
        title: 'Shipment Tracking',
        description: 'Monitor deliveries and logistics',
      },
    ],
    trucking: [
      {
        icon: IconTruck,
        title: 'Fleet Management',
        description: 'Monitor vehicles and routes',
      },
      {
        icon: IconUsers,
        title: 'Driver Management',
        description: 'Track driver schedules and performance',
      },
      {
        icon: IconChartBar,
        title: 'Trip Analytics',
        description: 'Analyze trip data and efficiency',
      },
      {
        icon: IconSettings,
        title: 'Operations',
        description: 'Streamline daily operations',
      },
    ],
  } as const;

  type BusinessFeature =
    (typeof businessFeatures)[keyof typeof businessFeatures][number];

  const workspaceStats = {
    operations: {
      color: 'blue' as const,
      icon: IconSettings,
      description: 'Operational Management',
    },
    employees: {
      color: 'green' as const,
      icon: IconUsers,
      description: 'Human Resources',
    },
  } as const;

  const selectedFeatures = (businessFeatures[
    selectedBusiness as keyof typeof businessFeatures
  ] ?? []) as readonly BusinessFeature[];

  return (
    <Container size="xl" p="xl">
      {/* Authentication Status Banner */}
      {status === 'authenticated' && session?.user && (
        <Alert
          variant="light"
          color="green"
          title="Authentication Status"
          icon={<IconUserCheck size={20} />}
          mb="xl"
          styles={{
            root: {
              border: '2px solid var(--mantine-color-green-3)',
            },
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                ✅ Logged in as: {session.user.email}
              </Text>
              <Group gap="xs">
                <Badge
                  size="sm"
                  leftSection={<IconShieldCheck size={12} />}
                  color={
                    session.user.role === 'SUPER_ADMIN'
                      ? 'red'
                      : session.user.role === 'ADMIN'
                        ? 'orange'
                        : 'blue'
                  }
                  variant="filled"
                >
                  {session.user.role}
                </Badge>
                <Text size="xs" c="dimmed">
                  {session.user.role === 'SUPER_ADMIN'
                    ? 'Full access to all pages'
                    : session.user.role === 'ADMIN'
                      ? 'Access to Operations + Employees'
                      : 'Access to Operations only'}
                </Text>
              </Group>
            </Stack>
            <LogoutButton />
          </Group>
        </Alert>
      )}

      {/* Hero Section */}
      <Box mb="xl">
        <Center>
          <Stack gap="lg" align="center" maw={800}>
            <Badge
              size="lg"
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Modern Business Management
            </Badge>

            <Title
              order={1}
              ta="center"
              size="3.5rem"
              fw={900}
              className="gradient-text"
            >
              Czarlie & Ron
            </Title>

            <Title order={2} ta="center" size="1.8rem" fw={400} c="dimmed">
              Streamlined Business Operations
            </Title>

            <Text size="lg" ta="center" c="dimmed" maw={600}>
              Comprehensive management solution for clothing and trucking
              operations. Manage employees, track inventory, monitor shipments,
              and analyze business performance.
            </Text>
          </Stack>
        </Center>
      </Box>

      {/* Business Selection Status */}
      {!selectedBusiness && (
        <Paper p="xl" radius="lg" bg="blue.0" mb="xl">
          <Stack align="center" gap="md">
            <ThemeIcon size="xl" radius="xl" variant="light" color="blue">
              <IconBuilding size={24} />
            </ThemeIcon>
            <Title order={3} ta="center">
              Get Started
            </Title>
            <Text size="md" ta="center" c="dimmed" maw={500}>
              Select a business from the navigation menu above to access your
              management dashboard and explore all available features.
            </Text>
          </Stack>
        </Paper>
      )}

      {selectedBusiness && !selectedWorkspace && (
        <Paper p="xl" radius="lg" bg="orange.0" mb="xl">
          <Stack align="center" gap="md">
            <ThemeIcon size="xl" radius="xl" variant="light" color="orange">
              <IconDashboard size={24} />
            </ThemeIcon>
            <Title order={3} ta="center">
              Choose Your Workspace
            </Title>
            <Text size="md" ta="center" c="dimmed" maw={500}>
              Select a workspace to continue to your business management
              dashboard.
            </Text>
          </Stack>
        </Paper>
      )}

      {/* Active Business Dashboard */}
      {selectedBusiness && selectedWorkspace && (
        <Stack gap="xl">
          {/* Current Selection */}
          <Card shadow="md" padding="xl" radius="lg" withBorder>
            <Group justify="space-between" mb="md">
              <Group>
                <ThemeIcon
                  size="xl"
                  radius="md"
                  variant="gradient"
                  gradient={{
                    from: selectedBusiness === 'clothing' ? 'pink' : 'blue',
                    to: selectedBusiness === 'clothing' ? 'orange' : 'cyan',
                  }}
                >
                  {selectedBusiness === 'clothing' ? (
                    <IconShirt size={24} />
                  ) : (
                    <IconTruck size={24} />
                  )}
                </ThemeIcon>
                <Stack gap={4}>
                  <Title order={3}>
                    {selectedBusiness === 'clothing'
                      ? 'Czarlie & Ron Clothing'
                      : 'Czarlie & Ron Trucking'}
                  </Title>
                  <Group gap="xs">
                    <Badge
                      color={
                        workspaceStats[
                          selectedWorkspace as keyof typeof workspaceStats
                        ]?.color
                      }
                      variant="light"
                      leftSection={React.createElement(
                        workspaceStats[
                          selectedWorkspace as keyof typeof workspaceStats
                        ]?.icon || IconSettings,
                        { size: 12 }
                      )}
                    >
                      {selectedWorkspace === 'operations'
                        ? 'Operations Workspace'
                        : 'Employees Workspace'}
                    </Badge>
                  </Group>
                </Stack>
              </Group>
              <Button
                variant="light"
                rightSection={<IconArrowRight size={16} />}
                size="sm"
              >
                Go to Dashboard
              </Button>
            </Group>
            <Text c="dimmed">
              {
                workspaceStats[selectedWorkspace as keyof typeof workspaceStats]
                  ?.description
              }{' '}
              - Use the sidebar navigation to access different sections and
              manage your business operations.
            </Text>
          </Card>

          {/* Feature Cards */}
          <Stack gap="md">
            <Title order={4} c="dimmed">
              Available Features
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {selectedFeatures.map((feature) => (
                <Card
                  key={feature.title}
                  shadow="sm"
                  padding="lg"
                  radius="md"
                  withBorder
                  className="modern-card"
                >
                  <Stack gap="md">
                    <ThemeIcon
                      size="lg"
                      radius="md"
                      variant="light"
                      color="blue"
                    >
                      <feature.icon size={20} />
                    </ThemeIcon>
                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        {feature.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {feature.description}
                      </Text>
                    </Stack>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        </Stack>
      )}

      {/* Business Overview Cards (when no business selected) */}
      {!selectedBusiness && (
        <Stack gap="md">
          <Title order={4} c="dimmed" ta="center">
            Our Business Solutions
          </Title>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Card
              shadow="lg"
              padding="xl"
              radius="lg"
              withBorder
              className="modern-card"
            >
              <Stack gap="lg">
                <Group>
                  <ThemeIcon
                    size="xl"
                    radius="md"
                    variant="gradient"
                    gradient={{ from: 'pink', to: 'orange' }}
                  >
                    <IconShirt size={28} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Title order={3}>Clothing Business</Title>
                    <Text c="dimmed">Fashion & Retail Management</Text>
                  </Stack>
                </Group>
                <Text size="sm" c="dimmed">
                  Complete solution for fashion retail operations including
                  inventory management, customer relations, shipment tracking,
                  and business intelligence.
                </Text>
                <SimpleGrid cols={2} spacing="sm">
                  {businessFeatures.clothing.map((feature) => (
                    <Group key={feature.title} gap="xs">
                      <feature.icon size={14} color="gray" />
                      <Text size="xs">{feature.title}</Text>
                    </Group>
                  ))}
                </SimpleGrid>
              </Stack>
            </Card>

            <Card
              shadow="lg"
              padding="xl"
              radius="lg"
              withBorder
              className="modern-card"
            >
              <Stack gap="lg">
                <Group>
                  <ThemeIcon
                    size="xl"
                    radius="md"
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan' }}
                  >
                    <IconTruck size={28} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Title order={3}>Trucking Business</Title>
                    <Text c="dimmed">Logistics & Transportation</Text>
                  </Stack>
                </Group>
                <Text size="sm" c="dimmed">
                  Comprehensive trucking operations management with fleet
                  tracking, driver management, trip analytics, and operational
                  efficiency tools.
                </Text>
                <SimpleGrid cols={2} spacing="sm">
                  {businessFeatures.trucking.map((feature) => (
                    <Group key={feature.title} gap="xs">
                      <feature.icon size={14} color="gray" />
                      <Text size="xs">{feature.title}</Text>
                    </Group>
                  ))}
                </SimpleGrid>
              </Stack>
            </Card>
          </SimpleGrid>
        </Stack>
      )}
    </Container>
  );
}

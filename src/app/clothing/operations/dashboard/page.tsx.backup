'use client';

import React from 'react';
import {
  Grid,
  Card,
  Text,
  Title,
  Stack,
  Group,
  ThemeIcon,
  Badge,
  SimpleGrid,
  RingProgress,
  Center,
  Box,
} from '@mantine/core';
import {
  IconUsers,
  IconReceipt,
  IconPackage,
  IconChartBar,
  IconCurrencyDollar,
  IconTruck,
  IconShirt,
} from '@tabler/icons-react';
import { PageLayout } from '../../../../components/layout/PageLayout';

export default function OperationsDashboard() {
  const stats = [
    {
      title: 'Total Revenue',
      value: '$45,231',
      change: '+12.5%',
      color: 'green',
      icon: IconCurrencyDollar,
    },
    {
      title: 'Active Orders',
      value: '234',
      change: '+8.2%',
      color: 'blue',
      icon: IconReceipt,
    },
    {
      title: 'Customers',
      value: '1,432',
      change: '+3.1%',
      color: 'violet',
      icon: IconUsers,
    },
    {
      title: 'Products',
      value: '856',
      change: '+5.4%',
      color: 'orange',
      icon: IconPackage,
    },
  ];

  return (
    <PageLayout title="Operations Dashboard">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Stack gap="xs">
            <Text c="dimmed" size="lg">
              Welcome back! Here’s what’s happening with your clothing business.
            </Text>
          </Stack>
          <Badge size="lg" variant="light" color="pink">
            <Group gap="xs">
              <IconShirt size={14} />
              <Text>Clothing Operations</Text>
            </Group>
          </Badge>
        </Group>

        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {stats.map((stat, index) => (
            <Card
              key={index}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              className="modern-card"
            >
              <Group justify="space-between">
                <Stack gap="xs">
                  <Text size="sm" c="dimmed" fw={500}>
                    {stat.title}
                  </Text>
                  <Text size="xl" fw={700}>
                    {stat.value}
                  </Text>
                  <Badge size="sm" variant="light" color={stat.color}>
                    {stat.change}
                  </Badge>
                </Stack>
                <ThemeIcon
                  size="xl"
                  radius="md"
                  variant="light"
                  color={stat.color}
                >
                  <stat.icon size={24} />
                </ThemeIcon>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        {/* Charts and Analytics */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              className="modern-card"
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={3}>Sales Overview</Title>
                  <Badge variant="light" color="blue">
                    This Month
                  </Badge>
                </Group>
                <Box
                  h={300}
                  style={{
                    background:
                      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  <Stack align="center" gap="md">
                    <ThemeIcon
                      size="xl"
                      radius="xl"
                      variant="white"
                      color="pink"
                    >
                      <IconChartBar size={28} />
                    </ThemeIcon>
                    <Text size="lg" fw={600}>
                      Sales Analytics
                    </Text>
                    <Text size="sm" ta="center" opacity={0.8}>
                      Interactive clothing sales charts will be displayed here
                    </Text>
                  </Stack>
                </Box>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {/* Performance Ring */}
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                className="modern-card"
              >
                <Stack gap="md" align="center">
                  <Title order={4}>Monthly Goal</Title>
                  <RingProgress
                    size={120}
                    thickness={8}
                    sections={[
                      {
                        value: 68,
                        color: 'pink',
                        tooltip: '68% - Clothing Sales',
                      },
                    ]}
                    label={
                      <Center>
                        <Text size="xl" fw={700}>
                          68%
                        </Text>
                      </Center>
                    }
                  />
                  <Text size="sm" c="dimmed" ta="center">
                    Target: $75,000 monthly revenue
                  </Text>
                </Stack>
              </Card>

              {/* Quick Actions */}
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                className="modern-card"
              >
                <Stack gap="md">
                  <Title order={4}>Today’s Activity</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ThemeIcon
                          size="sm"
                          radius="sm"
                          variant="light"
                          color="green"
                        >
                          <IconReceipt size={14} />
                        </ThemeIcon>
                        <Text size="sm">New Orders</Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        +23
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ThemeIcon
                          size="sm"
                          radius="sm"
                          variant="light"
                          color="blue"
                        >
                          <IconTruck size={14} />
                        </ThemeIcon>
                        <Text size="sm">Shipments</Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        12 pending
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ThemeIcon
                          size="sm"
                          radius="sm"
                          variant="light"
                          color="orange"
                        >
                          <IconPackage size={14} />
                        </ThemeIcon>
                        <Text size="sm">Low Stock</Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        5 items
                      </Text>
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>

        {/* Recent Activity */}
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          className="modern-card"
        >
          <Stack gap="md">
            <Title order={3}>Recent Activity</Title>
            <Stack gap="sm">
              {[
                {
                  action: 'New summer collection order received',
                  time: '2 minutes ago',
                  color: 'green',
                },
                {
                  action: 'T-shirt inventory updated',
                  time: '15 minutes ago',
                  color: 'blue',
                },
                {
                  action: 'Customer size inquiry',
                  time: '1 hour ago',
                  color: 'orange',
                },
                {
                  action: 'Bulk order shipped to retailer',
                  time: '2 hours ago',
                  color: 'violet',
                },
              ].map((activity, index) => (
                <Group
                  key={index}
                  justify="space-between"
                  p="sm"
                  style={{
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface-2)',
                  }}
                >
                  <Group gap="sm">
                    <ThemeIcon
                      size="sm"
                      radius="sm"
                      variant="light"
                      color={activity.color}
                    >
                      <IconShirt size={14} />
                    </ThemeIcon>
                    <Text size="sm">{activity.action}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {activity.time}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Stack>
        </Card>
      </Stack>
    </PageLayout>
  );
}

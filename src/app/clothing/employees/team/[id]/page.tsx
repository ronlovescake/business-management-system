'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Stack,
  Paper,
  Title,
  Text,
  Group,
  Badge,
  Button,
  Grid,
  Card,
  Divider,
  Avatar,
  ActionIcon,
  Tabs,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconMail,
  IconPhone,
  IconMapPin,
  IconCalendar,
  IconCurrencyPeso,
  IconBuilding,
  IconUser,
  IconHistory,
  IconFileText,
  IconAlertCircle,
} from '@tabler/icons-react';
import { PageLayout } from '../../../../../components/layout/PageLayout';
import { useEmployeeDetail } from '@/app/clothing/employees/team/hooks/useEmployeeDetail';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const {
    employee,
    isLoading,
    formatDate,
    formatCurrency,
    getStatusColor,
    handleEdit,
  } = useEmployeeDetail(employeeId);

  if (isLoading) {
    return (
      <PageLayout>
        <Text>Loading...</Text>
      </PageLayout>
    );
  }

  if (!employee) {
    return (
      <PageLayout>
        <Paper p="xl" withBorder>
          <Group>
            <IconAlertCircle size={48} color="red" />
            <div>
              <Title order={3}>Employee Not Found</Title>
              <Text c="dimmed">
                The employee with ID {employeeId} could not be found.
              </Text>
              <Button
                leftSection={<IconArrowLeft size={16} />}
                variant="light"
                mt="md"
                onClick={() => router.push('/clothing/employees/team')}
              >
                Back to Team
              </Button>
            </div>
          </Group>
        </Paper>
      </PageLayout>
    );
  }

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {/* Header with Back Button */}
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => router.push('/clothing/employees/team')}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={2}>Employee Details</Title>
              <Text size="sm" c="dimmed">
                View and manage employee information
              </Text>
            </div>
          </Group>
          <Button leftSection={<IconEdit size={16} />} onClick={handleEdit}>
            Edit Employee
          </Button>
        </Group>

        {/* Employee Profile Card */}
        <Paper withBorder p="xl">
          <Group align="flex-start">
            <Avatar
              size={120}
              radius="md"
              color="blue"
              style={{ fontSize: '3rem' }}
            >
              {employee.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()}
            </Avatar>
            <Stack gap="xs" style={{ flex: 1 }}>
              <Group justify="space-between">
                <div>
                  <Title order={2}>{employee.name}</Title>
                  <Text size="lg" c="dimmed" mt={4}>
                    {employee.jobTitle}
                  </Text>
                </div>
                <Badge
                  size="lg"
                  color={getStatusColor(employee.status)}
                  variant="light"
                >
                  {employee.status === 'on-leave'
                    ? 'ON LEAVE'
                    : employee.status.toUpperCase()}
                </Badge>
              </Group>

              <Grid mt="md">
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <IconUser size={18} color="gray" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Employee ID
                      </Text>
                      <Text fw={500}>{employee.employeeId}</Text>
                    </div>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <IconBuilding size={18} color="gray" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Department
                      </Text>
                      <Text fw={500}>{employee.department}</Text>
                    </div>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <IconCalendar size={18} color="gray" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Hire Date
                      </Text>
                      <Text fw={500}>{formatDate(employee.hireDate)}</Text>
                    </div>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <IconCurrencyPeso size={18} color="gray" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Basic Salary
                      </Text>
                      <Text fw={600} c="green">
                        {formatCurrency(employee.basicSalary)}
                      </Text>
                    </div>
                  </Group>
                </Grid.Col>
              </Grid>
            </Stack>
          </Group>
        </Paper>

        {/* Tabs for Different Sections */}
        <Tabs defaultValue="contact">
          <Tabs.List>
            <Tabs.Tab value="contact" leftSection={<IconPhone size={16} />}>
              Contact Information
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
              Employment History
            </Tabs.Tab>
            <Tabs.Tab
              value="documents"
              leftSection={<IconFileText size={16} />}
            >
              Documents
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="contact" pt="lg">
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder p="lg">
                  <Stack gap="md">
                    <Group gap="sm">
                      <IconMail size={20} />
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">
                          Email Address
                        </Text>
                        <Text fw={500}>{employee.email || 'Not provided'}</Text>
                      </div>
                    </Group>
                    <Divider />
                    <Group gap="sm">
                      <IconPhone size={20} />
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">
                          Contact Number
                        </Text>
                        <Text fw={500}>{employee.contact}</Text>
                      </div>
                    </Group>
                    <Divider />
                    <Group gap="sm">
                      <IconMapPin size={20} />
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">
                          Address
                        </Text>
                        <Text fw={500}>
                          {employee.address || 'Not provided'}
                        </Text>
                      </div>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder p="lg">
                  <Stack gap="md">
                    <Group gap="sm">
                      <IconAlertCircle size={20} />
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">
                          Emergency Contact
                        </Text>
                        <Text fw={500}>
                          {employee.emergencyContact || 'Not provided'}
                        </Text>
                      </div>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="lg">
            <Card withBorder p="lg">
              <Text c="dimmed" ta="center">
                Employment history coming soon
              </Text>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="documents" pt="lg">
            <Card withBorder p="lg">
              <Text c="dimmed" ta="center">
                Documents section coming soon
              </Text>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </PageLayout>
  );
}

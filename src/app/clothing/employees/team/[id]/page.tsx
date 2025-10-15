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
  Card,
  Divider,
  Avatar,
  ActionIcon,
  Grid,
  Box,
} from '@mantine/core';
import { IconArrowLeft, IconEdit, IconAlertCircle } from '@tabler/icons-react';
import { PageLayout } from '../../../../../components/layout/PageLayout';
import { useEmployeeDetail } from '@/app/clothing/employees/team/hooks/useEmployeeDetail';
import { EmployeeFormDialog } from '../components/EmployeeFormDialog';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const {
    employee,
    isLoading,
    isFormOpen,
    setIsFormOpen,
    formatDate,
    formatCurrency,
    getStatusColor,
    handleEdit,
    handleSaveEmployee,
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

  // Organize all employee fields into categories
  const employeeDetails: Array<{
    label: string;
    value: string | number | undefined;
    category: string;
  }> = [
    // Personal Information
    {
      label: 'Employee Name',
      value:
        employee.firstName && employee.lastName
          ? `${employee.firstName} ${employee.middleName ? employee.middleName + ' ' : ''}${employee.lastName}`
          : employee.name,
      category: 'Personal Information',
    },
    {
      label: 'First Name',
      value: employee.firstName,
      category: 'Personal Information',
    },
    {
      label: 'Last Name',
      value: employee.lastName,
      category: 'Personal Information',
    },
    {
      label: 'Middle Name',
      value: employee.middleName || 'N/A',
      category: 'Personal Information',
    },
    {
      label: 'Gender',
      value: employee.gender || 'N/A',
      category: 'Personal Information',
    },
    {
      label: 'Date of Birth',
      value: employee.dateOfBirth ? formatDate(employee.dateOfBirth) : 'N/A',
      category: 'Personal Information',
    },
    {
      label: 'Marital Status',
      value: employee.maritalStatus || 'N/A',
      category: 'Personal Information',
    },
    {
      label: 'Number of Kids',
      value: employee.numberOfKids?.toString() || 'N/A',
      category: 'Personal Information',
    },
    {
      label: 'Education',
      value: employee.education || 'N/A',
      category: 'Personal Information',
    },
    {
      label: 'Driving License',
      value: employee.drivingLicense || 'N/A',
      category: 'Personal Information',
    },

    // Contact Information
    {
      label: 'Email',
      value: employee.email || 'N/A',
      category: 'Contact Information',
    },
    {
      label: 'Phone',
      value: employee.phone || employee.contact,
      category: 'Contact Information',
    },
    {
      label: 'Address',
      value: employee.address || 'N/A',
      category: 'Contact Information',
    },
    {
      label: 'Emergency Contact Person',
      value: employee.emergencyContactPerson || 'N/A',
      category: 'Contact Information',
    },
    {
      label: 'Emergency Contact Number',
      value:
        employee.emergencyContactNumber || employee.emergencyContact || 'N/A',
      category: 'Contact Information',
    },

    // Employment Details
    {
      label: 'Employee ID',
      value: employee.employeeId,
      category: 'Employment Details',
    },
    {
      label: 'Department',
      value: employee.department,
      category: 'Employment Details',
    },
    {
      label: 'Position',
      value: employee.position || employee.jobTitle,
      category: 'Employment Details',
    },
    {
      label: 'Hire Date',
      value: formatDate(employee.hireDate),
      category: 'Employment Details',
    },
    { label: 'Status', value: employee.status, category: 'Employment Details' },
    {
      label: 'Employment Status',
      value: employee.employmentStatus || 'N/A',
      category: 'Employment Details',
    },
    {
      label: 'Employee Type',
      value: employee.employeeType || 'N/A',
      category: 'Employment Details',
    },
    {
      label: 'Office',
      value: employee.office || 'N/A',
      category: 'Employment Details',
    },
    {
      label: 'Hiring Source',
      value: employee.hiringSource || 'N/A',
      category: 'Employment Details',
    },

    // Government IDs
    {
      label: 'SSS Number',
      value: employee.sssNumber || 'N/A',
      category: 'Government IDs',
    },
    {
      label: 'PhilHealth Number',
      value: employee.philHealthNumber || 'N/A',
      category: 'Government IDs',
    },
    {
      label: 'HDMF / Pag-IBIG Number',
      value: employee.hdmfNumber || 'N/A',
      category: 'Government IDs',
    },
    {
      label: 'TIN / Tax Details',
      value: employee.tinNumber || 'N/A',
      category: 'Government IDs',
    },

    // Compensation
    {
      label: 'Current Salary',
      value: formatCurrency(employee.currentSalary || employee.basicSalary),
      category: 'Compensation',
    },
    {
      label: 'Basic Salary',
      value: formatCurrency(employee.basicSalary),
      category: 'Compensation',
    },
    {
      label: 'Allowance',
      value: employee.allowance ? formatCurrency(employee.allowance) : 'N/A',
      category: 'Compensation',
    },
    {
      label: 'Payment Schedule',
      value: employee.paymentSchedule || 'N/A',
      category: 'Compensation',
    },
    {
      label: 'Bank / GCash Account',
      value: employee.bankAccount || employee.gcashAccount || 'N/A',
      category: 'Compensation',
    },
  ];

  // Group details by category
  const categories = Array.from(
    new Set(employeeDetails.map((d) => d.category))
  );

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
                Complete employee information
              </Text>
            </div>
          </Group>
          <Button leftSection={<IconEdit size={16} />} onClick={handleEdit}>
            Edit Employee
          </Button>
        </Group>

        {/* Employee Profile Summary Card */}
        <Paper withBorder p="xl">
          <Group align="center" gap="lg">
            <Avatar
              size={100}
              radius="md"
              color="blue"
              style={{ fontSize: '2.5rem' }}
            >
              {employee.firstName?.[0]?.toUpperCase() ||
                employee.name?.split(' ')[0]?.[0]?.toUpperCase() ||
                ''}
              {employee.lastName?.[0]?.toUpperCase() ||
                employee.name?.split(' ')[1]?.[0]?.toUpperCase() ||
                ''}
            </Avatar>
            <div style={{ flex: 1 }}>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Title order={2}>
                    {employee.firstName && employee.lastName
                      ? `${employee.firstName} ${employee.middleName ? employee.middleName + ' ' : ''}${employee.lastName}`
                      : employee.name}
                  </Title>
                  <Text size="lg" c="dimmed" mt={4}>
                    {employee.position || employee.jobTitle}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {employee.department} • {employee.employeeId}
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
            </div>
          </Group>
        </Paper>

        {/* Detailed Information Tables by Category */}
        {categories.map((category) => {
          const categoryDetails = employeeDetails.filter(
            (d) => d.category === category
          );

          return (
            <Card key={category} withBorder padding={0}>
              <Paper p="md" bg="gray.0">
                <Title order={4}>{category}</Title>
              </Paper>
              <Divider />
              <Box p="lg">
                <Grid gutter="md">
                  {categoryDetails.map((detail) => (
                    <Grid.Col
                      span={{ base: 12, sm: 6, md: 4 }}
                      key={`${category}-${detail.label}`}
                    >
                      <Box>
                        <Text
                          size="xs"
                          fw={600}
                          c="dimmed"
                          tt="uppercase"
                          mb={4}
                        >
                          {detail.label}
                        </Text>
                        {detail.label.toLowerCase().includes('salary') ||
                        detail.label.toLowerCase().includes('allowance') ? (
                          <Text
                            fw={600}
                            size="sm"
                            c={detail.value !== 'N/A' ? 'green' : 'dimmed'}
                          >
                            {detail.value}
                          </Text>
                        ) : (
                          <Text
                            size="sm"
                            c={detail.value === 'N/A' ? 'dimmed' : undefined}
                          >
                            {detail.value}
                          </Text>
                        )}
                      </Box>
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            </Card>
          );
        })}
      </Stack>

      {/* Form Dialog */}
      <EmployeeFormDialog
        opened={isFormOpen}
        editingEmployee={employee}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveEmployee}
      />
    </PageLayout>
  );
}

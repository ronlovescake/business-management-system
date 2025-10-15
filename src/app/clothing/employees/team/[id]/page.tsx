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
  FileButton,
  Tooltip,
  Overlay,
  Loader,
  UnstyledButton,
  Center,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconAlertCircle,
  IconCamera,
} from '@tabler/icons-react';
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
    handleProfilePhotoUpload,
    isPhotoUploading,
  } = useEmployeeDetail(employeeId);

  const [isAvatarHovered, setIsAvatarHovered] = React.useState(false);

  const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Unable to read file'));
        }
      };
      reader.onerror = (event) => {
        reject(event instanceof Error ? event : new Error('File read error'));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE) {
      alert('Please select an image that is 2MB or smaller.');
      return;
    }

    try {
      const base64 = await convertFileToBase64(file);
      await handleProfilePhotoUpload(base64);
    } catch (error) {
      console.error('Failed to upload profile photo:', error);
      alert('Failed to upload profile photo. Please try again.');
    }
  };

  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str: string | undefined | null): string => {
    if (!str) {
      return 'N/A';
    }
    return str
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

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
      value: capitalizeWords(employee.gender),
      category: 'Personal Information',
    },
    {
      label: 'Date of Birth',
      value: employee.dateOfBirth ? formatDate(employee.dateOfBirth) : 'N/A',
      category: 'Personal Information',
    },
    {
      label: 'Marital Status',
      value: capitalizeWords(employee.maritalStatus),
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
    {
      label: 'Status',
      value: capitalizeWords(employee.status),
      category: 'Employment Details',
    },
    {
      label: 'Employment Status',
      value: capitalizeWords(employee.employmentStatus),
      category: 'Employment Details',
    },
    {
      label: 'Employee Type',
      value: capitalizeWords(employee.employeeType),
      category: 'Employment Details',
    },
    {
      label: 'Office',
      value: capitalizeWords(employee.office),
      category: 'Employment Details',
    },
    {
      label: 'Hiring Source',
      value: capitalizeWords(employee.hiringSource),
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
      value: capitalizeWords(employee.paymentSchedule),
      category: 'Compensation',
    },
    {
      label: 'Bank Account',
      value: employee.bankAccount || 'N/A',
      category: 'Compensation',
    },
    {
      label: 'GCash Account',
      value: employee.gcashAccount || 'N/A',
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
            <Box
              pos="relative"
              onMouseEnter={() => setIsAvatarHovered(true)}
              onMouseLeave={() => setIsAvatarHovered(false)}
              style={{ borderRadius: 'var(--mantine-radius-md)' }}
            >
              <FileButton
                onChange={handleAvatarFileChange}
                accept="image/png,image/jpeg,image/webp"
              >
                {(props) => (
                  <Tooltip label="Upload profile photo" position="right">
                    <UnstyledButton
                      {...props}
                      style={{ display: 'block', borderRadius: 'inherit' }}
                    >
                      <Avatar
                        size={100}
                        radius="md"
                        color="blue"
                        style={{ fontSize: '2.5rem' }}
                        src={employee.profilePhoto || undefined}
                      >
                        {employee.firstName?.[0]?.toUpperCase() ||
                          employee.name?.split(' ')[0]?.[0]?.toUpperCase() ||
                          ''}
                        {employee.lastName?.[0]?.toUpperCase() ||
                          employee.name?.split(' ')[1]?.[0]?.toUpperCase() ||
                          ''}
                      </Avatar>
                    </UnstyledButton>
                  </Tooltip>
                )}
              </FileButton>

              {(isAvatarHovered || isPhotoUploading) && (
                <Overlay
                  opacity={0.45}
                  color="#000"
                  radius="md"
                  style={{ pointerEvents: 'none' }}
                >
                  <Center style={{ height: '100%' }}>
                    {isPhotoUploading ? (
                      <Loader size="sm" color="white" />
                    ) : (
                      <Group gap={6} align="center">
                        <IconCamera size={18} color="#fff" />
                        <Text size="xs" c="white">
                          Change photo
                        </Text>
                      </Group>
                    )}
                  </Center>
                </Overlay>
              )}
            </Box>
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

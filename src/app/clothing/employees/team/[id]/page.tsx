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
  Tabs,
  ScrollArea,
  Table,
  Timeline,
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
    isLoadingRelated,
    payrollHistory,
    totalPayrollAmount,
    attendanceHistory,
    leaveHistory,
    salaryTimeline,
    cashAdvanceRecords,
    outstandingCashAdvance,
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
      value: capitalizeWords(employee.education) || 'N/A',
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

  const formatPayrollPeriod = (record: (typeof payrollHistory)[number]) => {
    if (record.payPeriod && record.payPeriod.trim().length > 0) {
      return record.payPeriod;
    }
    if (record.periodStart && record.periodEnd) {
      return `${formatDate(record.periodStart)} - ${formatDate(
        record.periodEnd
      )}`;
    }
    if (record.periodStart) {
      return formatDate(record.periodStart);
    }
    return 'N/A';
  };

  const formatOptionalDate = (value?: string | null) => {
    if (!value) {
      return '—';
    }
    const formatted = formatDate(value);
    return formatted === 'Invalid Date' ? value : formatted;
  };

  const getPayrollStatusBadgeColor = (
    status: (typeof payrollHistory)[number]['status']
  ) => {
    switch (status) {
      case 'paid':
        return 'green';
      case 'approved':
        return 'blue';
      default:
        return 'yellow';
    }
  };

  const getAttendanceStatusColor = (
    status: (typeof attendanceHistory)[number]['status']
  ) => {
    switch (status) {
      case 'present':
        return 'green';
      case 'late':
        return 'yellow';
      case 'absent':
        return 'red';
      case 'on-leave':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getLeaveStatusColor = (
    status: (typeof leaveHistory)[number]['status']
  ) => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      default:
        return 'yellow';
    }
  };

  const getCashAdvanceStatusColor = (
    status: (typeof cashAdvanceRecords)[number]['status']
  ) => {
    switch (status) {
      case 'paid':
        return 'green';
      case 'approved':
        return 'blue';
      case 'rejected':
        return 'red';
      default:
        return 'yellow';
    }
  };

  const attendanceToDisplay = attendanceHistory;
  const leaveToDisplay = leaveHistory;
  const salaryTimelineToDisplay = salaryTimeline;

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

        {/* Employee Profile Summary Card always visible */}
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

        <Tabs defaultValue="profile">
          <Tabs.List>
            <Tabs.Tab value="profile">Profile</Tabs.Tab>
            <Tabs.Tab value="payroll">Payroll History</Tabs.Tab>
            <Tabs.Tab value="attendance">Attendance Records</Tabs.Tab>
            <Tabs.Tab value="leave">Leave Requests</Tabs.Tab>
            <Tabs.Tab value="cash-advance">Cash Advance Summary</Tabs.Tab>
            <Tabs.Tab value="salary-timeline">Salary Timeline</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="profile" pt="md">
            <Stack gap="lg">
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
                              detail.label
                                .toLowerCase()
                                .includes('allowance') ? (
                                <Text
                                  fw={600}
                                  size="sm"
                                  c={
                                    detail.value !== 'N/A' ? 'green' : 'dimmed'
                                  }
                                >
                                  {detail.value}
                                </Text>
                              ) : (
                                <Text
                                  size="sm"
                                  c={
                                    detail.value === 'N/A'
                                      ? 'dimmed'
                                      : undefined
                                  }
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
          </Tabs.Panel>

          <Tabs.Panel value="payroll" pt="md">
            <Stack gap="lg">
              <Card withBorder padding="lg">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Title order={4}>Payroll History</Title>
                    <Text size="sm" c="dimmed">
                      Total net pay recorded:{' '}
                      {formatCurrency(totalPayrollAmount)}
                    </Text>
                  </div>
                  <Badge variant="light" color="blue">
                    {payrollHistory.length} records
                  </Badge>
                </Group>
                <Divider my="md" />
                {isLoadingRelated ? (
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                ) : payrollHistory.length === 0 ? (
                  <Text c="dimmed">
                    No payroll entries yet for this employee.
                  </Text>
                ) : (
                  <ScrollArea h="68vh">
                    <Table highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Pay Period</Table.Th>
                          <Table.Th>Net Pay</Table.Th>
                          <Table.Th>Gross Pay</Table.Th>
                          <Table.Th>Deductions</Table.Th>
                          <Table.Th>Cash Advance</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {payrollHistory.map((record) => (
                          <Table.Tr key={record.id}>
                            <Table.Td>{formatPayrollPeriod(record)}</Table.Td>
                            <Table.Td>{formatCurrency(record.netPay)}</Table.Td>
                            <Table.Td>
                              {formatCurrency(record.grossPay)}
                            </Table.Td>
                            <Table.Td>
                              {formatCurrency(record.totalDeductions)}
                            </Table.Td>
                            <Table.Td>
                              {formatCurrency(record.cashAdvance)}
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={getPayrollStatusBadgeColor(
                                  record.status
                                )}
                                variant="light"
                              >
                                {record.status.toUpperCase()}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="attendance" pt="md">
            <Stack gap="lg">
              <Card withBorder padding="lg">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Title order={4}>Attendance Records</Title>
                    <Text size="sm" c="dimmed">
                      Showing all {attendanceHistory.length} entries
                    </Text>
                  </div>
                </Group>
                <Divider my="md" />
                {isLoadingRelated ? (
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                ) : attendanceToDisplay.length === 0 ? (
                  <Text c="dimmed">
                    No attendance entries found for this employee.
                  </Text>
                ) : (
                  <ScrollArea h="68vh">
                    <Table highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Time In</Table.Th>
                          <Table.Th>Time Out</Table.Th>
                          <Table.Th>Total Hours</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {attendanceToDisplay.map((record) => (
                          <Table.Tr key={record.id}>
                            <Table.Td>
                              {formatOptionalDate(record.date)}
                            </Table.Td>
                            <Table.Td>{record.timeIn || '—'}</Table.Td>
                            <Table.Td>{record.timeOut || '—'}</Table.Td>
                            <Table.Td>
                              {Number.isFinite(record.totalHours)
                                ? record.totalHours.toFixed(2)
                                : '0.00'}
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={getAttendanceStatusColor(record.status)}
                                variant="light"
                              >
                                {record.status.replace('-', ' ').toUpperCase()}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="leave" pt="md">
            <Stack gap="lg">
              <Card withBorder padding="lg">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Title order={4}>Leave Requests</Title>
                    <Text size="sm" c="dimmed">
                      Showing all {leaveHistory.length} requests
                    </Text>
                  </div>
                </Group>
                <Divider my="md" />
                {isLoadingRelated ? (
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                ) : leaveToDisplay.length === 0 ? (
                  <Text c="dimmed">
                    No leave requests recorded for this employee.
                  </Text>
                ) : (
                  <ScrollArea h="68vh">
                    <Table highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Date Range</Table.Th>
                          <Table.Th>Days</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Payment</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {leaveToDisplay.map((request) => (
                          <Table.Tr key={request.id}>
                            <Table.Td>{request.leaveType}</Table.Td>
                            <Table.Td>
                              {`${formatOptionalDate(request.startDate)} - ${formatOptionalDate(
                                request.endDate
                              )}`}
                            </Table.Td>
                            <Table.Td>{request.numberOfDays}</Table.Td>
                            <Table.Td>
                              <Badge
                                color={getLeaveStatusColor(request.status)}
                                variant="light"
                              >
                                {request.status.toUpperCase()}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="outline">
                                {request.paymentStatus.toUpperCase()}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="cash-advance" pt="md">
            <Stack gap="lg">
              <Card withBorder padding="lg">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Title order={4}>Cash Advance Summary</Title>
                    <Text size="sm" c="dimmed">
                      Outstanding balance:{' '}
                      {formatCurrency(outstandingCashAdvance)}
                    </Text>
                  </div>
                  <Badge variant="light" color="grape">
                    {cashAdvanceRecords.length} requests
                  </Badge>
                </Group>
                <Divider my="md" />
                {isLoadingRelated ? (
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                ) : cashAdvanceRecords.length === 0 ? (
                  <Text c="dimmed">
                    No cash advance history yet. When this employee requests a
                    cash advance it will appear here.
                  </Text>
                ) : (
                  <ScrollArea h="68vh">
                    <Table highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Request Date</Table.Th>
                          <Table.Th>Amount</Table.Th>
                          <Table.Th>Settled</Table.Th>
                          <Table.Th>Remaining</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {cashAdvanceRecords.map((record) => (
                          <Table.Tr key={record.id}>
                            <Table.Td>
                              {formatOptionalDate(record.requestDate)}
                            </Table.Td>
                            <Table.Td>{formatCurrency(record.amount)}</Table.Td>
                            <Table.Td>
                              {formatCurrency(record.settledAmount ?? 0)}
                            </Table.Td>
                            <Table.Td>
                              {formatCurrency(record.remainingBalance ?? 0)}
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={getCashAdvanceStatusColor(record.status)}
                                variant="light"
                              >
                                {record.status.toUpperCase()}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="salary-timeline" pt="md">
            <Stack gap="lg">
              <Card withBorder padding="lg">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Title order={4}>Salary Timeline</Title>
                    <Text size="sm" c="dimmed">
                      Tracks base salary and allowance adjustments
                    </Text>
                  </div>
                </Group>
                <Divider my="md" />
                {isLoadingRelated ? (
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                ) : salaryTimelineToDisplay.length === 0 ? (
                  <Text c="dimmed">
                    No salary adjustments detected in payroll history.
                  </Text>
                ) : (
                  <ScrollArea h="68vh">
                    <Timeline
                      active={salaryTimelineToDisplay.length - 1}
                      bulletSize={16}
                      lineWidth={2}
                    >
                      {salaryTimelineToDisplay.map((entry) => (
                        <Timeline.Item
                          key={`${entry.id}-${entry.effectiveFrom}`}
                          title={formatOptionalDate(entry.effectiveFrom)}
                        >
                          <Text size="sm" fw={600}>
                            {entry.payPeriodLabel}
                          </Text>
                          <Text size="sm" c="dimmed">
                            Basic {formatCurrency(entry.basicSalary)} •
                            Allowance {formatCurrency(entry.allowance)} • Gross{' '}
                            {formatCurrency(entry.grossPay)}
                          </Text>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </ScrollArea>
                )}
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>
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

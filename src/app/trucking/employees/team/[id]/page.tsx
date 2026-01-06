'use client';

import { showError } from '@/lib/alerts';
import { logger } from '@/lib/logger';
import { useParams, useRouter } from 'next/navigation';
import { Button, Group, Paper, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconEdit } from '@tabler/icons-react';
import { PageLayout } from '../../../../../components/layout/PageLayout';
import { useEmployeeDetail } from '@/app/trucking/employees/team/hooks/useEmployeeDetail';
import { EmployeeFormDialog } from '../components/EmployeeFormDialog';
import { SalaryTimeline } from '../components/SalaryTimeline';
import { DetailsHeader } from '@/modules/shared/details/DetailsHeader';
import {
  DetailsPageTemplate,
  type DetailsTabConfig,
} from '@/modules/shared/details/DetailsPageTemplate';
import { TruckingEmployeeProfileSummaryCard } from '../components/TruckingEmployeeProfileSummaryCard';
import { ProfileOverviewTab } from '../components/tabs/ProfileOverviewTab';
import { PayrollHistoryTab } from '../components/tabs/PayrollHistoryTab';
import { SchedulesTab } from '../components/tabs/SchedulesTab';
import { AttendanceTab } from '../components/tabs/AttendanceTab';
import { LeaveRequestsTab } from '../components/tabs/LeaveRequestsTab';
import { CashAdvanceTab } from '../components/tabs/CashAdvanceTab';
import { StatutoryDetailsTab } from '../components/tabs/StatutoryDetailsTab';
import { ThirteenthMonthPayTab } from '../components/tabs/ThirteenthMonthPayTab';
import type { EmployeeDetailField } from '../types/detail-field';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();

  if (!params || !params.id) {
    throw new Error('Employee id is required for EmployeeDetailPage');
  }

  const employeeId = Array.isArray(params.id) ? params.id[0] : params.id;

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
    scheduleHistory,
    leaveHistory,
    cashAdvanceRecords,
    outstandingCashAdvance,
    thirteenthMonthRecords,
    totalThirteenthMonthPay,
    isLoadingThirteenthMonth,
  } = useEmployeeDetail(employeeId);

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
      await showError(
        'Please select an image that is 2MB or smaller.',
        'File Size Error'
      );
      return;
    }

    try {
      const base64 = await convertFileToBase64(file);
      await handleProfilePhotoUpload(base64);
    } catch (error) {
      logger.error('Failed to upload profile photo:', error);
      await showError(
        'Failed to upload profile photo. Please try again.',
        'Upload Failed'
      );
    }
  };

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

  const extractSuffix = (fullName: string | undefined | null): string => {
    if (!fullName) {
      return '';
    }
    const commaMatch = fullName.match(/,\s*(.+)$/);
    if (commaMatch?.[1]) {
      return commaMatch[1];
    }
    const parts = fullName.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1]?.toLowerCase();
    const common = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
    return lastPart && common.has(lastPart) ? parts[parts.length - 1] : '';
  };

  const suffix = employee?.suffix || extractSuffix(employee?.name);
  const fullName = employee
    ? `${employee.firstName} ${employee.middleName ? employee.middleName + ' ' : ''}${employee.lastName}${suffix ? ` ${suffix}` : ''}`
        .replace(/\s+/g, ' ')
        .trim()
    : '';

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
                onClick={() => router.push('/trucking/employees/team')}
              >
                Back to Team
              </Button>
            </div>
          </Group>
        </Paper>
      </PageLayout>
    );
  }

  const employeeDetails: EmployeeDetailField[] = [
    {
      label: 'Employee Name',
      value: fullName || employee.name,
      category: 'Personal Information',
    },
    {
      label: 'Suffix',
      value: suffix || 'N/A',
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

  const categories = Array.from(
    new Set(employeeDetails.map((d) => d.category))
  );

  const formatPayrollPeriod = (record: (typeof payrollHistory)[number]) => {
    if (record.payPeriod && record.payPeriod.trim().length > 0) {
      return record.payPeriod;
    }
    if (record.periodStart && record.periodEnd) {
      return `${formatDate(record.periodStart)} - ${formatDate(record.periodEnd)}`;
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

  const getThirteenthStatusColor = (
    status: (typeof thirteenthMonthRecords)[number]['status']
  ) => {
    switch (status) {
      case 'paid':
        return 'grape';
      case 'approved':
        return 'green';
      case 'calculated':
        return 'blue';
      default:
        return 'yellow';
    }
  };

  const getScheduleStatusColor = (
    status: (typeof scheduleHistory)[number]['status']
  ) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'cancelled':
        return 'red';
      default:
        return 'blue';
    }
  };

  const formatShiftLabel = (
    shift: (typeof scheduleHistory)[number]['shiftType']
  ) => {
    switch (shift) {
      case 'morning':
        return 'Morning (8:00 AM - 5:00 PM)';
      case 'afternoon':
        return 'Afternoon (3:00 PM - 12:00 AM)';
      case 'night':
        return 'Night (12:00 AM - 9:00 AM)';
      case 'full-day':
        return 'Full Day (4:00 AM - 5:00 PM)';
      default:
        return shift;
    }
  };

  const formatContribution = (value?: number | null) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return formatCurrency(value);
    }
    return 'N/A';
  };

  const attendanceToDisplay = attendanceHistory;
  const scheduleToDisplay = scheduleHistory;
  const leaveToDisplay = leaveHistory;

  const currentYear = new Date().getFullYear();
  const ANNUAL_LEAVE_ENTITLEMENT = 7;

  const usedPaidLeaveDays = leaveHistory
    .filter((leave) => {
      const leaveYear = new Date(leave.startDate).getFullYear();
      return (
        leaveYear === currentYear &&
        leave.status === 'approved' &&
        leave.paymentStatus === 'paid'
      );
    })
    .reduce((total, leave) => total + (leave.numberOfDays || 0), 0);

  const remainingLeaveDays = Math.max(
    ANNUAL_LEAVE_ENTITLEMENT - usedPaidLeaveDays,
    0
  );

  const statutoryDetails = [
    {
      label: 'SSS Number',
      value: employee.sssNumber || 'N/A',
    },
    {
      label: 'PhilHealth Number',
      value: employee.philHealthNumber || 'N/A',
    },
    {
      label: 'Pag-IBIG / HDMF Number',
      value: employee.hdmfNumber || 'N/A',
    },
    {
      label: 'TIN',
      value: employee.tinNumber || 'N/A',
    },
    {
      label: 'Payment Schedule',
      value: capitalizeWords(employee.paymentSchedule) || 'N/A',
    },
    {
      label: 'Bank Account',
      value: employee.bankAccount || 'N/A',
    },
    {
      label: 'GCash Account',
      value: employee.gcashAccount || 'N/A',
    },
  ];

  const statutoryContributionDetails = [
    {
      label: 'SSS Monthly Contribution',
      value: formatContribution(employee.sssMonthlyContribution ?? null),
    },
    {
      label: 'PhilHealth Monthly Contribution',
      value: formatContribution(employee.philHealthMonthlyContribution ?? null),
    },
    {
      label: 'Pag-IBIG Monthly Contribution',
      value: formatContribution(employee.pagibigMonthlyContribution ?? null),
    },
    {
      label: 'Income Tax Contribution',
      value: formatContribution(employee.taxMonthlyContribution ?? null),
    },
  ];

  const header = (
    <DetailsHeader
      title="Employee Details"
      subtitle="Complete employee information"
      backAction={{
        label: 'Back to team list',
        onClick: () => router.push('/trucking/employees/team'),
      }}
      primaryAction={{
        label: 'Edit Employee',
        onClick: handleEdit,
        icon: <IconEdit size={16} />,
      }}
    />
  );

  const heroSection = (
    <TruckingEmployeeProfileSummaryCard
      employee={employee}
      onAvatarChange={handleAvatarFileChange}
      isPhotoUploading={isPhotoUploading}
      getStatusColor={getStatusColor}
    />
  );

  const tabs: DetailsTabConfig[] = [
    {
      value: 'profile',
      label: 'Profile',
      content: (
        <ProfileOverviewTab categories={categories} details={employeeDetails} />
      ),
    },
    {
      value: 'payroll',
      label: 'Payroll History',
      content: (
        <PayrollHistoryTab
          isLoading={isLoadingRelated}
          payrollHistory={payrollHistory}
          totalPayrollAmount={totalPayrollAmount}
          formatCurrency={formatCurrency}
          formatPayrollPeriod={formatPayrollPeriod}
          getStatusColor={getPayrollStatusBadgeColor}
        />
      ),
    },
    {
      value: 'thirteenth-month',
      label: '13th Month Pay',
      content: (
        <ThirteenthMonthPayTab
          isLoading={isLoadingThirteenthMonth}
          records={thirteenthMonthRecords}
          totalThirteenthMonthPay={totalThirteenthMonthPay}
          formatCurrency={formatCurrency}
          formatOptionalDate={formatOptionalDate}
          getStatusColor={getThirteenthStatusColor}
        />
      ),
    },
    {
      value: 'schedules',
      label: 'Schedules',
      content: (
        <SchedulesTab
          isLoading={isLoadingRelated}
          schedules={scheduleToDisplay}
          formatOptionalDate={formatOptionalDate}
          formatShiftLabel={formatShiftLabel}
          getStatusColor={getScheduleStatusColor}
        />
      ),
    },
    {
      value: 'attendance',
      label: 'Attendance Records',
      content: (
        <AttendanceTab
          isLoading={isLoadingRelated}
          records={attendanceToDisplay}
          formatOptionalDate={formatOptionalDate}
          getStatusColor={getAttendanceStatusColor}
        />
      ),
    },
    {
      value: 'leave',
      label: 'Leave Requests',
      content: (
        <LeaveRequestsTab
          isLoading={isLoadingRelated}
          leaveRequests={leaveToDisplay}
          currentYear={currentYear}
          annualEntitlement={ANNUAL_LEAVE_ENTITLEMENT}
          usedPaidLeaveDays={usedPaidLeaveDays}
          remainingLeaveDays={remainingLeaveDays}
          formatOptionalDate={formatOptionalDate}
          getStatusColor={getLeaveStatusColor}
        />
      ),
    },
    {
      value: 'cash-advance',
      label: 'Cash Advance Summary',
      content: (
        <CashAdvanceTab
          isLoading={isLoadingRelated}
          cashAdvanceRecords={cashAdvanceRecords}
          outstandingCashAdvance={outstandingCashAdvance}
          formatCurrency={formatCurrency}
          getStatusColor={getCashAdvanceStatusColor}
          formatOptionalDate={formatOptionalDate}
        />
      ),
    },
    {
      value: 'salary-timeline',
      label: 'Salary Timeline',
      content: (
        <SalaryTimeline
          employeeId={employeeId}
          currentBasicSalary={employee.basicSalary || 0}
          currentAllowance={employee.allowance || 0}
        />
      ),
    },
    {
      value: 'statutory',
      label: 'Statutory Details',
      content: (
        <StatutoryDetailsTab
          statutoryDetails={statutoryDetails}
          contributionDetails={statutoryContributionDetails}
        />
      ),
    },
  ];

  return (
    <>
      <DetailsPageTemplate
        header={header}
        heroSection={heroSection}
        tabs={tabs}
        defaultTab="profile"
      />
      <EmployeeFormDialog
        opened={isFormOpen}
        editingEmployee={employee}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveEmployee}
      />
    </>
  );
}

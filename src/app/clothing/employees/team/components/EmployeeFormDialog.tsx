import React, { useEffect } from 'react';
import {
  TextInput,
  NumberInput,
  Grid,
  Select,
  Divider,
  Text,
  Stack,
  Group,
  Button,
  Switch,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { UniversalModal } from '@/components/modals/UniversalModal';

import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { IconUserPlus, IconUserEdit } from '@tabler/icons-react';
import { getCurrentDateISO, toDate, toISODate } from '@/utils/date';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import {
  EMPLOYEE_STATUS_OPTIONS,
  type Employee,
  type EmployeeFormData,
} from '../types';

interface EmployeeFormDialogProps {
  opened: boolean;
  editingEmployee: Employee | null;
  onClose: () => void;
  onSave: (data: EmployeeFormData) => void;
}

export const EmployeeFormDialog = React.memo(function EmployeeFormDialog({
  opened,
  editingEmployee,
  onClose,
  onSave,
}: EmployeeFormDialogProps) {
  const form = useForm<EmployeeFormData>({
    initialValues: {
      employeeId: '',
      firstName: '',
      lastName: '',
      middleName: '',
      suffix: '',
      name: '',
      phone: '',
      contact: '',
      email: '',
      department: '',
      position: '',
      jobTitle: '',
      currentSalary: '',
      basicSalary: '',
      hireDate: getCurrentDateISO(),
      employmentEndDate: '',
      status: 'active',
      employmentStatus: 'probationary',
      employeeType: 'full-time',
      office: '',
      hiringSource: '',
      finalPayPending: false,
      finalPayEffectiveDate: '',
      finalPayNotes: '',
      sssNumber: '',
      philHealthNumber: '',
      hdmfNumber: '',
      tinNumber: '',
      gender: '',
      education: '',
      dateOfBirth: '',
      maritalStatus: '',
      numberOfKids: '',
      drivingLicense: '',
      address: '',
      emergencyContactPerson: '',
      emergencyContactNumber: '',
      emergencyContact: '',
      bankAccount: '',
      gcashAccount: '',
      allowance: '',
      paymentSchedule: 'bi-monthly',
      profilePhoto: '',
      sssMonthlyContribution: '',
      philHealthMonthlyContribution: '',
      pagibigMonthlyContribution: '',
      taxMonthlyContribution: '',
    },
    validate: {
      firstName: (value) => (!value ? 'First name is required' : null),
      lastName: (value) => (!value ? 'Last name is required' : null),
      phone: (value) => (!value ? 'Contact number is required' : null),
      department: (value) => (!value ? 'Department is required' : null),
      position: (value) => (!value ? 'Position is required' : null),
      hireDate: (value) => (!value ? 'Hire date is required' : null),
      basicSalary: (value) => {
        if (!value) {
          return 'Basic salary is required';
        }
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Basic salary must be greater than 0';
        }
        return null;
      },
    },
  });

  const extractSuffix = (fullName: string) => {
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

  useEffect(() => {
    if (editingEmployee) {
      const suffix = extractSuffix(editingEmployee.name);
      form.setValues({
        employeeId: editingEmployee.employeeId,
        firstName: editingEmployee.firstName,
        lastName: editingEmployee.lastName,
        middleName: editingEmployee.middleName || '',
        suffix,
        name: editingEmployee.name,
        phone: editingEmployee.phone,
        contact: editingEmployee.contact,
        email: editingEmployee.email || '',
        department: editingEmployee.department,
        position: editingEmployee.position,
        jobTitle: editingEmployee.jobTitle,
        currentSalary:
          editingEmployee.currentSalary !== undefined &&
          editingEmployee.currentSalary !== null
            ? editingEmployee.currentSalary.toString()
            : editingEmployee.basicSalary.toString(),
        basicSalary: editingEmployee.basicSalary.toString(),
        hireDate: editingEmployee.hireDate,
        employmentEndDate: editingEmployee.employmentEndDate || '',
        status: editingEmployee.status,
        employmentStatus: editingEmployee.employmentStatus || 'probationary',
        employeeType: editingEmployee.employeeType || 'full-time',
        office: editingEmployee.office || '',
        hiringSource: editingEmployee.hiringSource || '',
        finalPayPending: !!editingEmployee.finalPayPending,
        finalPayEffectiveDate: editingEmployee.finalPayEffectiveDate || '',
        finalPayNotes: editingEmployee.finalPayNotes || '',
        sssNumber: editingEmployee.sssNumber || '',
        philHealthNumber: editingEmployee.philHealthNumber || '',
        hdmfNumber: editingEmployee.hdmfNumber || '',
        tinNumber: editingEmployee.tinNumber || '',
        gender: editingEmployee.gender || '',
        education: editingEmployee.education || '',
        dateOfBirth: editingEmployee.dateOfBirth || '',
        maritalStatus: editingEmployee.maritalStatus || '',
        numberOfKids: editingEmployee.numberOfKids?.toString() || '',
        drivingLicense: editingEmployee.drivingLicense || '',
        address: editingEmployee.address || '',
        emergencyContactPerson: editingEmployee.emergencyContactPerson || '',
        emergencyContactNumber: editingEmployee.emergencyContactNumber || '',
        emergencyContact: editingEmployee.emergencyContact || '',
        bankAccount: editingEmployee.bankAccount || '',
        gcashAccount: editingEmployee.gcashAccount || '',
        allowance: editingEmployee.allowance?.toString() || '',
        paymentSchedule: editingEmployee.paymentSchedule || 'bi-monthly',
        profilePhoto: editingEmployee.profilePhoto || '',
        sssMonthlyContribution:
          editingEmployee.sssMonthlyContribution !== undefined &&
          editingEmployee.sssMonthlyContribution !== null
            ? editingEmployee.sssMonthlyContribution.toString()
            : '',
        philHealthMonthlyContribution:
          editingEmployee.philHealthMonthlyContribution !== undefined &&
          editingEmployee.philHealthMonthlyContribution !== null
            ? editingEmployee.philHealthMonthlyContribution.toString()
            : '',
        pagibigMonthlyContribution:
          editingEmployee.pagibigMonthlyContribution !== undefined &&
          editingEmployee.pagibigMonthlyContribution !== null
            ? editingEmployee.pagibigMonthlyContribution.toString()
            : '',
        taxMonthlyContribution:
          editingEmployee.taxMonthlyContribution !== undefined &&
          editingEmployee.taxMonthlyContribution !== null
            ? editingEmployee.taxMonthlyContribution.toString()
            : '',
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingEmployee, opened]);

  const handleSubmit = (values: EmployeeFormData) => {
    const suffixPart = values.suffix ? ` ${values.suffix}` : '';
    const fullName =
      `${values.firstName} ${values.middleName ? values.middleName + ' ' : ''}${values.lastName}${suffixPart}`
        .replace(/\s+/g, ' ')
        .trim();
    const dataToSave = {
      ...values,
      name: fullName,
      contact: values.phone, // Copy phone to contact for backward compatibility
      jobTitle: values.position, // Copy position to jobTitle for backward compatibility
    };
    onSave(dataToSave);
    form.reset();
  };

  const handleSave = () => {
    form.onSubmit(handleSubmit)();
  };

  // Define fixed department options
  const departmentOptions = [
    'Operations',
    'HR',
    'Finance',
    'IT',
    'Cleaning & Maintenance',
  ];

  // Use the polished field styles hook
  const { getFieldProps, getSelectProps } = usePolishedFieldStyles(opened);

  const modalTitle = (
    <Group gap="sm" align="center">
      {editingEmployee ? (
        <IconUserEdit size={26} color="#65ab58" />
      ) : (
        <IconUserPlus size={26} color="#65ab58" />
      )}
      <Stack gap={2}>
        <Text fw={700} fz="lg" c="#101828">
          {editingEmployee ? 'Edit Employee' : 'Add Employee'}
        </Text>
        <Text fz="sm" c="#667085">
          {editingEmployee
            ? 'Update the employee details below'
            : 'Fill in the details to add a new team member'}
        </Text>
      </Stack>
    </Group>
  );

  return (
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title={modalTitle}
      size={1750}
    >
      <div
        style={{
          maxHeight: '82vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
        }}
      >
        <Stack gap="lg">
          <Grid gutter="sm">
            {/* Basic Information Section */}
            <Grid.Col span={12}>
              <Divider
                label={
                  <Text size="sm" fw={600}>
                    👤 Basic Information
                  </Text>
                }
                labelPosition="left"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="First Name"
                required
                {...form.getInputProps('firstName')}
                {...getFieldProps('firstName').handlers}
                styles={getFieldProps('firstName').styles}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Middle Name"
                {...form.getInputProps('middleName')}
                {...getFieldProps('middleName').handlers}
                styles={getFieldProps('middleName').styles}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Last Name"
                required
                {...form.getInputProps('lastName')}
                {...getFieldProps('lastName').handlers}
                styles={getFieldProps('lastName').styles}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Suffix"
                placeholder="Jr., Sr., III"
                {...form.getInputProps('suffix')}
                {...getFieldProps('suffix').handlers}
                styles={getFieldProps('suffix').styles}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Status"
                required
                data={EMPLOYEE_STATUS_OPTIONS}
                value={form.values.status}
                onChange={(value) => {
                  const nextStatus = (value ??
                    form.values.status ??
                    'active') as (typeof EMPLOYEE_STATUS_OPTIONS)[number]['value'];
                  form.setFieldValue('status', nextStatus);

                  // Autofill termination date when marking as resigned/terminated and no end date set yet
                  if (
                    ['terminated', 'resigned'].includes(nextStatus) &&
                    !form.values.employmentEndDate
                  ) {
                    form.setFieldValue(
                      'employmentEndDate',
                      getCurrentDateISO()
                    );
                  }
                }}
                {...getSelectProps('status').handlers}
                styles={getSelectProps('status').styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Education"
                data={[
                  { value: 'highschool', label: 'High School' },
                  { value: 'college', label: 'College' },
                  { value: 'vocational', label: 'Vocational' },
                  { value: 'postgrad', label: 'Post Graduate' },
                ]}
                {...form.getInputProps('education')}
                {...getSelectProps('education').handlers}
                styles={getSelectProps('education').styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Gender"
                data={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                ]}
                {...form.getInputProps('gender')}
                {...getSelectProps('gender').handlers}
                styles={getSelectProps('gender').styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Grid.Col>

            <Grid.Col span={4}>
              <DateInput
                label="Date of Birth"
                valueFormat="MM-DD-YYYY"
                value={toDate(form.values.dateOfBirth)}
                onChange={(value) =>
                  form.setFieldValue('dateOfBirth', toISODate(value))
                }
                {...COMMON_DATE_INPUT_PROPS}
                {...getFieldProps('dateOfBirth').handlers}
                styles={getFieldProps('dateOfBirth').styles}
              />
            </Grid.Col>

            <Grid.Col span={4}>
              <Select
                label="Marital Status"
                data={[
                  { value: 'single', label: 'Single' },
                  { value: 'married', label: 'Married' },
                  { value: 'separated', label: 'Separated' },
                  { value: 'widowed', label: 'Widowed' },
                ]}
                {...form.getInputProps('maritalStatus')}
                {...getSelectProps('maritalStatus').handlers}
                styles={getSelectProps('maritalStatus').styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Grid.Col>

            <Grid.Col span={4}>
              <NumberInput
                label="Number of Kids"
                min={0}
                hideControls
                value={form.values.numberOfKids}
                onChange={(value) =>
                  form.setFieldValue('numberOfKids', value?.toString() || '')
                }
                {...getFieldProps('numberOfKids').handlers}
                styles={getFieldProps('numberOfKids').styles}
              />
            </Grid.Col>
            {/* Employment Section */}
            <Grid.Col span={12}>
              <Divider
                label={
                  <Text size="sm" fw={600}>
                    💼 Employment
                  </Text>
                }
                labelPosition="left"
                mt="md"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Department"
                required
                data={departmentOptions}
                searchable
                {...form.getInputProps('department')}
                {...getSelectProps('department').handlers}
                styles={getSelectProps('department').styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Position"
                required
                {...form.getInputProps('position')}
                {...getFieldProps('position').handlers}
                styles={getFieldProps('position').styles}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <DateInput
                label="Hire Date"
                valueFormat="MM-DD-YYYY"
                required
                value={toDate(form.values.hireDate)}
                onChange={(value) =>
                  form.setFieldValue('hireDate', toISODate(value))
                }
                {...COMMON_DATE_INPUT_PROPS}
                {...getFieldProps('hireDate').handlers}
                styles={getFieldProps('hireDate').styles}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <DateInput
                label="Termination Date (Employment End)"
                valueFormat="MM-DD-YYYY"
                value={toDate(form.values.employmentEndDate)}
                onChange={(value) =>
                  form.setFieldValue('employmentEndDate', toISODate(value))
                }
                clearable
                {...COMMON_DATE_INPUT_PROPS}
                {...getFieldProps('employmentEndDate').handlers}
                styles={getFieldProps('employmentEndDate').styles}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Employment Status"
                data={[
                  { value: 'probationary', label: 'Probationary' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'contractual', label: 'Contractual' },
                  { value: 'project-based', label: 'Project-Based' },
                ]}
                {...form.getInputProps('employmentStatus')}
                {...getSelectProps('employmentStatus').handlers}
                styles={getSelectProps('employmentStatus').styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Employee Type"
                data={[
                  { value: 'full-time', label: 'Full-Time' },
                  { value: 'part-time', label: 'Part-Time' },
                  { value: 'contractor', label: 'Contractor' },
                  { value: 'stay-in', label: 'Stay-in' },
                ]}
                {...form.getInputProps('employeeType')}
                {...getSelectProps('employeeType').handlers}
                styles={getSelectProps('employeeType').styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Office Location"
                {...form.getInputProps('office')}
                {...getFieldProps('office').handlers}
                styles={getFieldProps('office').styles}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Hiring Source"
                {...form.getInputProps('hiringSource')}
                {...getFieldProps('hiringSource').handlers}
                styles={getFieldProps('hiringSource').styles}
              />
            </Grid.Col>

            <Grid.Col span={4}>
              <TextInput
                label="Driving License Number"
                {...form.getInputProps('drivingLicense')}
                {...getFieldProps('drivingLicense').handlers}
                styles={getFieldProps('drivingLicense').styles}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Divider
                label={
                  <Text size="sm" fw={600}>
                    📄 Final Pay & Offboarding
                  </Text>
                }
                labelPosition="left"
                mt="md"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Switch
                label="Final Pay Pending"
                description="Flag employees awaiting final payout"
                checked={form.values.finalPayPending}
                onChange={(event) =>
                  form.setFieldValue(
                    'finalPayPending',
                    event.currentTarget.checked
                  )
                }
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <DateInput
                label="Final Pay Effective Date"
                valueFormat="MM-DD-YYYY"
                value={toDate(form.values.finalPayEffectiveDate)}
                onChange={(value) =>
                  form.setFieldValue('finalPayEffectiveDate', toISODate(value))
                }
                clearable
                disabled={!form.values.finalPayPending}
                {...COMMON_DATE_INPUT_PROPS}
                {...getFieldProps('finalPayEffectiveDate').handlers}
                styles={getFieldProps('finalPayEffectiveDate').styles}
              />
            </Grid.Col>
            <Grid.Col span={8}>
              <Textarea
                label="Final Pay Notes"
                minRows={2}
                disabled={!form.values.finalPayPending}
                {...form.getInputProps('finalPayNotes')}
                {...getFieldProps('finalPayNotes').handlers}
                styles={getFieldProps('finalPayNotes').styles}
              />
            </Grid.Col>

            {/* Contact Section */}
            <Grid.Col span={12}>
              <Divider
                label={
                  <Text size="sm" fw={600}>
                    📞 Contact
                  </Text>
                }
                labelPosition="left"
                mt="md"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Phone Number"
                required
                {...form.getInputProps('phone')}
                {...getFieldProps('phone').handlers}
                styles={getFieldProps('phone').styles}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Email Address"
                type="email"
                {...form.getInputProps('email')}
                {...getFieldProps('email').handlers}
                styles={getFieldProps('email').styles}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput
                label="Address"
                {...form.getInputProps('address')}
                {...getFieldProps('address').handlers}
                styles={getFieldProps('address').styles}
              />
            </Grid.Col>
            {/* In case of emergency Section */}
            <Grid.Col span={12}>
              <Divider
                label={
                  <Text size="sm" fw={600}>
                    🚨 In case of emergency
                  </Text>
                }
                labelPosition="left"
                mt="md"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Emergency Contact Person"
                {...form.getInputProps('emergencyContactPerson')}
                {...getFieldProps('emergencyContactPerson').handlers}
                styles={getFieldProps('emergencyContactPerson').styles}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Emergency Contact Number"
                {...form.getInputProps('emergencyContactNumber')}
                {...getFieldProps('emergencyContactNumber').handlers}
                styles={getFieldProps('emergencyContactNumber').styles}
              />
            </Grid.Col>
            {/* Government IDs Section */}
            <Grid.Col span={12}>
              <Divider
                label={
                  <Text size="sm" fw={600}>
                    🏛️ Government IDs
                  </Text>
                }
                labelPosition="left"
                mt="md"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="SSS Number"
                {...form.getInputProps('sssNumber')}
                {...getFieldProps('sssNumber').handlers}
                styles={getFieldProps('sssNumber').styles}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="PhilHealth Number"
                {...form.getInputProps('philHealthNumber')}
                {...getFieldProps('philHealthNumber').handlers}
                styles={getFieldProps('philHealthNumber').styles}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="HDMF Number (Pag-IBIG)"
                {...form.getInputProps('hdmfNumber')}
                {...getFieldProps('hdmfNumber').handlers}
                styles={getFieldProps('hdmfNumber').styles}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="TIN Number"
                {...form.getInputProps('tinNumber')}
                {...getFieldProps('tinNumber').handlers}
                styles={getFieldProps('tinNumber').styles}
              />
            </Grid.Col>
            {/* Statutory Contributions Section */}
            <Grid.Col span={12}>
              <Divider
                label={
                  <Text size="sm" fw={600}>
                    📊 Statutory Contributions (Monthly)
                  </Text>
                }
                labelPosition="left"
                mt="md"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label="SSS Contribution"
                min={0}
                prefix="₱"
                decimalScale={2}
                hideControls
                value={form.values.sssMonthlyContribution}
                onChange={(value) =>
                  form.setFieldValue(
                    'sssMonthlyContribution',
                    value?.toString() || ''
                  )
                }
                {...getFieldProps('sssMonthlyContribution').handlers}
                styles={getFieldProps('sssMonthlyContribution').styles}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label="PhilHealth Contribution"
                min={0}
                prefix="₱"
                decimalScale={2}
                hideControls
                value={form.values.philHealthMonthlyContribution}
                onChange={(value) =>
                  form.setFieldValue(
                    'philHealthMonthlyContribution',
                    value?.toString() || ''
                  )
                }
                {...getFieldProps('philHealthMonthlyContribution').handlers}
                styles={getFieldProps('philHealthMonthlyContribution').styles}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label="Pag-IBIG Contribution"
                min={0}
                prefix="₱"
                decimalScale={2}
                hideControls
                value={form.values.pagibigMonthlyContribution}
                onChange={(value) =>
                  form.setFieldValue(
                    'pagibigMonthlyContribution',
                    value?.toString() || ''
                  )
                }
                {...getFieldProps('pagibigMonthlyContribution').handlers}
                styles={getFieldProps('pagibigMonthlyContribution').styles}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label="Income Tax Contribution"
                min={0}
                prefix="₱"
                decimalScale={2}
                hideControls
                value={form.values.taxMonthlyContribution}
                onChange={(value) =>
                  form.setFieldValue(
                    'taxMonthlyContribution',
                    value?.toString() || ''
                  )
                }
                {...getFieldProps('taxMonthlyContribution').handlers}
                styles={getFieldProps('taxMonthlyContribution').styles}
              />
            </Grid.Col>
            {/* Financial Section */}
            <Grid.Col span={12}>
              <Divider
                label={
                  <Text size="sm" fw={600}>
                    💰 Financial
                  </Text>
                }
                labelPosition="left"
                mt="md"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label="Basic Salary"
                required
                min={0}
                prefix="₱"
                decimalScale={2}
                thousandSeparator=","
                hideControls
                value={form.values.basicSalary}
                onChange={(value) =>
                  form.setFieldValue('basicSalary', value?.toString() || '')
                }
                error={form.errors.basicSalary}
                {...getFieldProps('basicSalary').handlers}
                styles={getFieldProps('basicSalary').styles}
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <NumberInput
                label="Allowance"
                min={0}
                prefix="₱"
                decimalScale={2}
                thousandSeparator=","
                hideControls
                value={form.values.allowance}
                onChange={(value) =>
                  form.setFieldValue('allowance', value?.toString() || '')
                }
                {...getFieldProps('allowance').handlers}
                styles={getFieldProps('allowance').styles}
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <NumberInput
                label="Current Salary"
                min={0}
                prefix="₱"
                decimalScale={2}
                thousandSeparator=","
                hideControls
                value={form.values.currentSalary}
                onChange={(value) =>
                  form.setFieldValue('currentSalary', value?.toString() || '')
                }
                {...getFieldProps('currentSalary').handlers}
                styles={getFieldProps('currentSalary').styles}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Select
                label="Payment Schedule"
                data={[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'bi-weekly', label: 'Bi-Weekly' },
                  { value: 'bi-monthly', label: 'Bi-Monthly' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
                {...form.getInputProps('paymentSchedule')}
                {...getSelectProps('paymentSchedule').handlers}
                styles={getSelectProps('paymentSchedule').styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Bank Account"
                {...form.getInputProps('bankAccount')}
                {...getFieldProps('bankAccount').handlers}
                styles={getFieldProps('bankAccount').styles}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="GCash Account"
                {...form.getInputProps('gcashAccount')}
                {...getFieldProps('gcashAccount').handlers}
                styles={getFieldProps('gcashAccount').styles}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" gap="sm" mt="xl">
            <Button radius="md" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button radius="md" onClick={handleSave} disabled={!form.isValid()}>
              {editingEmployee ? 'Update Employee' : 'Add Employee'}
            </Button>
          </Group>
        </Stack>
      </div>
    </UniversalModal>
  );
});

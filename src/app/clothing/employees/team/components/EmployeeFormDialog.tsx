import { useEffect } from 'react';
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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { IconUserPlus, IconUserEdit } from '@tabler/icons-react';
import { getCurrentDateISO, toDate, toISODate } from '@/utils/date';
import type { Employee, EmployeeFormData } from '../types';

interface EmployeeFormDialogProps {
  opened: boolean;
  editingEmployee: Employee | null;
  onClose: () => void;
  onSave: (data: EmployeeFormData) => void;
}

export function EmployeeFormDialog({
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
      status: 'active',
      employmentStatus: 'probationary',
      employeeType: 'full-time',
      office: '',
      hiringSource: '',
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

  useEffect(() => {
    if (editingEmployee) {
      form.setValues({
        employeeId: editingEmployee.employeeId,
        firstName: editingEmployee.firstName,
        lastName: editingEmployee.lastName,
        middleName: editingEmployee.middleName || '',
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
        status: editingEmployee.status,
        employmentStatus: editingEmployee.employmentStatus || 'probationary',
        employeeType: editingEmployee.employeeType || 'full-time',
        office: editingEmployee.office || '',
        hiringSource: editingEmployee.hiringSource || '',
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
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingEmployee, opened]);

  const handleSubmit = (values: EmployeeFormData) => {
    // Generate full name from parts
    const fullName =
      `${values.firstName} ${values.middleName ? values.middleName + ' ' : ''}${values.lastName}`.trim();
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
    <PolishedModal
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
              <Select
                label="Status"
                required
                data={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'on-leave', label: 'On Leave' },
                ]}
                {...form.getInputProps('status')}
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
                firstDayOfWeek={0}
                value={toDate(form.values.dateOfBirth)}
                onChange={(value) =>
                  form.setFieldValue('dateOfBirth', toISODate(value))
                }
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
                firstDayOfWeek={0}
                required
                value={toDate(form.values.hireDate)}
                onChange={(value) =>
                  form.setFieldValue('hireDate', toISODate(value))
                }
                {...getFieldProps('hireDate').handlers}
                styles={getFieldProps('hireDate').styles}
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
            <Button
              radius="md"
              onClick={handleSave}
              disabled={!form.isValid()}
              styles={polishedPrimaryButtonStyles}
            >
              {editingEmployee ? 'Update Employee' : 'Add Employee'}
            </Button>
          </Group>
        </Stack>
      </div>
    </PolishedModal>
  );
}

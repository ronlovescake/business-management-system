import { useEffect } from 'react';
import {
  TextInput,
  NumberInput,
  Grid,
  Select,
  Divider,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ComposedDialog } from '@/components/shared/Dialog';
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
      hireDate: new Date().toISOString().split('T')[0],
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
      paymentSchedule: 'semi-monthly',
    },
    validate: {
      employeeId: (value) => (!value ? 'Employee ID is required' : null),
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
        currentSalary: editingEmployee.currentSalary.toString(),
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
        paymentSchedule: editingEmployee.paymentSchedule || 'semi-monthly',
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

  return (
    <ComposedDialog
      opened={opened}
      onClose={onClose}
      size={1400}
      header={{
        title: editingEmployee ? 'Edit Employee' : 'Add Employee',
        subtitle: editingEmployee
          ? 'Update the employee details below'
          : 'Fill in the details to add a new team member',
        iconColor: '#6366f1',
      }}
      body={{
        padding: 'lg',
        maxHeight: '85vh',
      }}
      footer={{
        layout: 'flex-end',
        secondaryButton: {
          label: 'Cancel',
          onClick: onClose,
          variant: 'default',
        },
        primaryButton: {
          label: editingEmployee ? 'Update Employee' : 'Add Employee',
          onClick: handleSave,
          disabled: !form.isValid(),
          color: '#6366f1',
        },
      }}
    >
      <Grid gutter="md">
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
            label="Employee ID"
            required
            {...form.getInputProps('employeeId')}
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
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="First Name"
            required
            {...form.getInputProps('firstName')}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="Middle Name"
            {...form.getInputProps('middleName')}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="Last Name"
            required
            {...form.getInputProps('lastName')}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="Date of Birth"
            type="date"
            {...form.getInputProps('dateOfBirth')}
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
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="Position"
            required
            {...form.getInputProps('position')}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="Hire Date"
            type="date"
            required
            {...form.getInputProps('hireDate')}
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
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <Select
            label="Employee Type"
            data={[
              { value: 'full-time', label: 'Full-Time' },
              { value: 'part-time', label: 'Part-Time' },
              { value: 'contractor', label: 'Contractor' },
              { value: 'intern', label: 'Intern' },
            ]}
            {...form.getInputProps('employeeType')}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="Office Location"
            {...form.getInputProps('office')}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="Hiring Source"
            {...form.getInputProps('hiringSource')}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput label="Education" {...form.getInputProps('education')} />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput
            label="Driving License Number"
            {...form.getInputProps('drivingLicense')}
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
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Email Address"
            type="email"
            {...form.getInputProps('email')}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <TextInput label="Address" {...form.getInputProps('address')} />
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
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Emergency Contact Number"
            {...form.getInputProps('emergencyContactNumber')}
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
          <TextInput label="SSS Number" {...form.getInputProps('sssNumber')} />
        </Grid.Col>

        <Grid.Col span={3}>
          <TextInput
            label="PhilHealth Number"
            {...form.getInputProps('philHealthNumber')}
          />
        </Grid.Col>

        <Grid.Col span={3}>
          <TextInput
            label="HDMF Number (Pag-IBIG)"
            {...form.getInputProps('hdmfNumber')}
          />
        </Grid.Col>

        <Grid.Col span={3}>
          <TextInput label="TIN Number" {...form.getInputProps('tinNumber')} />
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
          />
        </Grid.Col>

        <Grid.Col span={3}>
          <Select
            label="Payment Schedule"
            data={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'bi-weekly', label: 'Bi-Weekly' },
              { value: 'semi-monthly', label: 'Semi-Monthly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            {...form.getInputProps('paymentSchedule')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Bank Account"
            {...form.getInputProps('bankAccount')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="GCash Account"
            {...form.getInputProps('gcashAccount')}
          />
        </Grid.Col>
      </Grid>
    </ComposedDialog>
  );
}

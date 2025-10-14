import { useEffect } from 'react';
import { TextInput, NumberInput, Grid, Select } from '@mantine/core';
import { useForm } from '@mantine/form';
import { ComposedDialog } from '@/components/shared/Dialog';
import type { Employee, EmployeeFormData } from '../types';

interface EmployeeFormDialogProps {
  opened: boolean;
  editingEmployee: Employee | null;
  onClose: () => void;
  onSave: (data: EmployeeFormData) => void;
  departments: string[];
}

export function EmployeeFormDialog({
  opened,
  editingEmployee,
  onClose,
  onSave,
  departments,
}: EmployeeFormDialogProps) {
  const form = useForm<EmployeeFormData>({
    initialValues: {
      employeeId: '',
      name: '',
      department: '',
      jobTitle: '',
      status: 'active',
      hireDate: new Date().toISOString().split('T')[0],
      basicSalary: '',
      contact: '',
      email: '',
      address: '',
      emergencyContact: '',
    },
    validate: {
      employeeId: (value) => (!value ? 'Employee ID is required' : null),
      name: (value) => (!value ? 'Name is required' : null),
      department: (value) => (!value ? 'Department is required' : null),
      jobTitle: (value) => (!value ? 'Job title is required' : null),
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
      contact: (value) => (!value ? 'Contact number is required' : null),
    },
  });

  useEffect(() => {
    if (editingEmployee) {
      form.setValues({
        employeeId: editingEmployee.employeeId,
        name: editingEmployee.name,
        department: editingEmployee.department,
        jobTitle: editingEmployee.jobTitle,
        status: editingEmployee.status,
        hireDate: editingEmployee.hireDate,
        basicSalary: editingEmployee.basicSalary.toString(),
        contact: editingEmployee.contact,
        email: editingEmployee.email || '',
        address: editingEmployee.address || '',
        emergencyContact: editingEmployee.emergencyContact || '',
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingEmployee, opened]);

  const handleSubmit = (values: EmployeeFormData) => {
    onSave(values);
    form.reset();
  };

  const handleSave = () => {
    form.onSubmit(handleSubmit)();
  };

  // Filter out 'all' from departments for the select dropdown
  const departmentOptions = departments.filter((d) => d !== 'all');

  return (
    <ComposedDialog
      opened={opened}
      onClose={onClose}
      size="xl"
      header={{
        title: editingEmployee ? 'Edit Employee' : 'Add Employee',
        subtitle: editingEmployee
          ? 'Update the employee details below'
          : 'Fill in the details to add a new team member',
        iconColor: '#6366f1',
      }}
      body={{
        padding: 'md',
        maxHeight: '75vh',
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
        {/* Basic Information */}
        <Grid.Col span={12}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#495057',
              borderBottom: '2px solid #e9ecef',
              paddingBottom: '8px',
            }}
          >
            👤 Basic Information
          </div>
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Employee ID"
            placeholder="e.g., EMP-001"
            required
            {...form.getInputProps('employeeId')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Full Name"
            placeholder="Enter employee name"
            required
            {...form.getInputProps('name')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <Select
            label="Department"
            placeholder="Select department"
            required
            data={departmentOptions}
            searchable
            {...form.getInputProps('department')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Job Title"
            placeholder="e.g., Sales Manager"
            required
            {...form.getInputProps('jobTitle')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <Select
            label="Status"
            placeholder="Select status"
            required
            data={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'on-leave', label: 'On Leave' },
            ]}
            {...form.getInputProps('status')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Hire Date"
            type="date"
            required
            {...form.getInputProps('hireDate')}
          />
        </Grid.Col>

        {/* Compensation */}
        <Grid.Col span={12}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#495057',
              borderBottom: '2px solid #e9ecef',
              paddingBottom: '8px',
              marginTop: '16px',
            }}
          >
            💰 Compensation
          </div>
        </Grid.Col>

        <Grid.Col span={12}>
          <NumberInput
            label="Basic Salary"
            placeholder="Enter basic salary"
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

        {/* Contact Information */}
        <Grid.Col span={12}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#495057',
              borderBottom: '2px solid #e9ecef',
              paddingBottom: '8px',
              marginTop: '16px',
            }}
          >
            📞 Contact Information
          </div>
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Contact Number"
            placeholder="e.g., 09171234567"
            required
            {...form.getInputProps('contact')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Email Address"
            placeholder="e.g., john.doe@company.com"
            type="email"
            {...form.getInputProps('email')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Address"
            placeholder="Enter address (optional)"
            {...form.getInputProps('address')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Emergency Contact"
            placeholder="e.g., 09181234567 (optional)"
            {...form.getInputProps('emergencyContact')}
          />
        </Grid.Col>
      </Grid>
    </ComposedDialog>
  );
}

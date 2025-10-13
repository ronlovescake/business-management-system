import { useEffect } from 'react';
import {
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Grid,
  Stack,
  Paper,
  Text,
  Group,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ComposedDialog } from '@/components/shared/Dialog';
import { EmployeeLoan, EmployeeLoanFormData } from '../types';
import {
  IconUser,
  IconCash,
  IconPercentage,
  IconCalendar,
  IconFileText,
  IconNote,
  IconCategory,
} from '@tabler/icons-react';

interface LoanFormDialogProps {
  opened: boolean;
  editingLoan: EmployeeLoan | null;
  onClose: () => void;
  onSave: (data: EmployeeLoanFormData) => void;
}

export function LoanFormDialog({
  opened,
  editingLoan,
  onClose,
  onSave,
}: LoanFormDialogProps) {
  const form = useForm<EmployeeLoanFormData>({
    initialValues: {
      employee: '',
      loanType: 'personal',
      amount: '',
      interestRate: '',
      termMonths: '12',
      applicationDate: new Date().toISOString().split('T')[0],
      purpose: '',
      notes: '',
    },
    validate: {
      employee: (value) => (!value ? 'Employee name is required' : null),
      loanType: (value) => (!value ? 'Loan type is required' : null),
      amount: (value) => {
        if (!value) return 'Amount is required';
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return 'Amount must be greater than 0';
        return null;
      },
      interestRate: (value) => {
        if (!value) return 'Interest rate is required';
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) return 'Interest rate must be 0 or greater';
        return null;
      },
      termMonths: (value) => {
        if (!value) return 'Term is required';
        const num = parseInt(value);
        if (isNaN(num) || num <= 0) return 'Term must be greater than 0';
        return null;
      },
      applicationDate: (value) =>
        !value ? 'Application date is required' : null,
      purpose: (value) => (!value ? 'Purpose is required' : null),
    },
  });

  useEffect(() => {
    if (editingLoan) {
      form.setValues({
        employee: editingLoan.employee,
        loanType: editingLoan.loanType,
        amount: editingLoan.amount.toString(),
        interestRate: editingLoan.interestRate.toString(),
        termMonths: editingLoan.termMonths.toString(),
        applicationDate: editingLoan.applicationDate,
        purpose: editingLoan.purpose,
        notes: editingLoan.notes || '',
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLoan, opened]);

  const handleSubmit = (values: EmployeeLoanFormData) => {
    onSave(values);
    form.reset();
  };

  const handleSave = () => {
    form.onSubmit(handleSubmit)();
  };

  return (
    <ComposedDialog
      opened={opened}
      onClose={onClose}
      size="xl"
      header={{
        title: editingLoan ? 'Edit Loan Application' : 'New Loan Application',
        subtitle: editingLoan
          ? 'Update the loan application details'
          : 'Fill in the details to submit a new loan application',
        iconColor: '#85bd3a',
      }}
      body={{
        padding: 'xl',
        maxHeight: '75vh',
      }}
      footer={{
        layout: 'flex-end',
        secondaryButton: {
          label: 'Cancel',
          onClick: onClose,
          variant: 'subtle',
        },
        primaryButton: {
          label: editingLoan ? 'Update Loan' : 'Submit Application',
          onClick: handleSave,
          disabled: !form.isValid(),
          color: '#85bd3a',
        },
      }}
    >
      <Stack gap="xl">
        {/* Employee & Loan Type Section */}
        <Paper
          p="lg"
          radius="md"
          style={{
            background:
              'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.1)',
          }}
        >
          <Group mb="md" gap="xs">
            <ThemeIcon
              size={40}
              radius="md"
              variant="gradient"
              gradient={{ from: '#6366f1', to: '#8b5cf6', deg: 135 }}
              style={{
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              }}
            >
              <IconUser size={22} stroke={2.5} />
            </ThemeIcon>
            <Text fw={700} size="md" c="#8b5cf6">
              Applicant Information
            </Text>
          </Group>

          <Grid gutter="md">
            <Grid.Col span={6}>
              <TextInput
                label="Employee Name"
                placeholder="Enter employee name"
                required
                leftSection={<IconUser size={18} opacity={0.7} />}
                styles={{
                  label: {
                    fontWeight: 600,
                    color: '#e0e7ff',
                  },
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1.5px solid rgba(139, 92, 246, 0.3)',
                    fontWeight: 500,
                    '&:focus': {
                      borderColor: '#8b5cf6',
                      backgroundColor: 'rgba(255, 255, 255, 0.18)',
                      boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.15)',
                    },
                    '&::placeholder': {
                      color: 'rgba(255, 255, 255, 0.4)',
                    },
                  },
                }}
                {...form.getInputProps('employee')}
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <Select
                label="Loan Type"
                placeholder="Select loan type"
                required
                leftSection={<IconCategory size={18} opacity={0.7} />}
                data={[
                  { value: 'personal', label: 'Personal Loan' },
                  { value: 'emergency', label: 'Emergency Loan' },
                  { value: 'educational', label: 'Educational Loan' },
                  { value: 'housing', label: 'Housing Loan' },
                  { value: 'vehicle', label: 'Vehicle Loan' },
                ]}
                styles={{
                  label: {
                    fontWeight: 600,
                    color: '#e0e7ff',
                  },
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1.5px solid rgba(139, 92, 246, 0.3)',
                    fontWeight: 500,
                    '&:focus': {
                      borderColor: '#8b5cf6',
                      backgroundColor: 'rgba(255, 255, 255, 0.18)',
                      boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.15)',
                    },
                  },
                }}
                {...form.getInputProps('loanType')}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        {/* Financial Details Section */}
        <Paper
          p="lg"
          radius="md"
          style={{
            background:
              'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1)',
          }}
        >
          <Group mb="md" gap="xs">
            <ThemeIcon
              size={40}
              radius="md"
              variant="gradient"
              gradient={{ from: '#10b981', to: '#059669', deg: 135 }}
              style={{
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
            >
              <IconCash size={22} stroke={2.5} />
            </ThemeIcon>
            <Text fw={700} size="md" c="#10b981">
              Financial Details
            </Text>
          </Group>

          <Grid gutter="md">
            <Grid.Col span={4}>
              <NumberInput
                label="Loan Amount"
                placeholder="0.00"
                required
                min={0}
                prefix="$"
                decimalScale={2}
                thousandSeparator=","
                hideControls
                leftSection={<IconCash size={18} opacity={0.7} />}
                styles={{
                  label: {
                    fontWeight: 600,
                    color: '#d1fae5',
                  },
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1.5px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: '#10b981',
                    '&:focus': {
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(255, 255, 255, 0.18)',
                      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)',
                    },
                    '&::placeholder': {
                      color: 'rgba(16, 185, 129, 0.4)',
                    },
                  },
                }}
                value={form.values.amount}
                onChange={(value) =>
                  form.setFieldValue('amount', value?.toString() || '')
                }
                error={form.errors.amount}
              />
            </Grid.Col>

            <Grid.Col span={4}>
              <NumberInput
                label="Interest Rate"
                placeholder="0.00"
                required
                min={0}
                max={100}
                decimalScale={2}
                suffix="%"
                hideControls
                leftSection={<IconPercentage size={18} opacity={0.7} />}
                styles={{
                  label: {
                    fontWeight: 600,
                    color: '#d1fae5',
                  },
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1.5px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: '#10b981',
                    '&:focus': {
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(255, 255, 255, 0.18)',
                      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)',
                    },
                    '&::placeholder': {
                      color: 'rgba(16, 185, 129, 0.4)',
                    },
                  },
                }}
                value={form.values.interestRate}
                onChange={(value) =>
                  form.setFieldValue('interestRate', value?.toString() || '')
                }
                error={form.errors.interestRate}
              />
            </Grid.Col>

            <Grid.Col span={4}>
              <NumberInput
                label="Term (Months)"
                placeholder="12"
                required
                min={1}
                max={360}
                hideControls
                leftSection={<IconCalendar size={18} opacity={0.7} />}
                styles={{
                  label: {
                    fontWeight: 600,
                    color: '#d1fae5',
                  },
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1.5px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: '#10b981',
                    '&:focus': {
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(255, 255, 255, 0.18)',
                      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)',
                    },
                    '&::placeholder': {
                      color: 'rgba(16, 185, 129, 0.4)',
                    },
                  },
                }}
                value={form.values.termMonths}
                onChange={(value) =>
                  form.setFieldValue('termMonths', value?.toString() || '')
                }
                error={form.errors.termMonths}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        {/* Additional Details Section */}
        <Paper
          p="lg"
          radius="md"
          style={{
            background:
              'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)',
          }}
        >
          <Group mb="md" gap="xs">
            <ThemeIcon
              size={40}
              radius="md"
              variant="gradient"
              gradient={{ from: '#ef4444', to: '#dc2626', deg: 135 }}
              style={{
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              }}
            >
              <IconFileText size={22} stroke={2.5} />
            </ThemeIcon>
            <Text fw={700} size="md" c="#ef4444">
              Additional Details
            </Text>
          </Group>

          <Stack gap="md">
            <TextInput
              label="Application Date"
              type="date"
              required
              leftSection={<IconCalendar size={18} opacity={0.7} />}
              styles={{
                label: {
                  fontWeight: 600,
                  color: '#fecaca',
                },
                input: {
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  border: '1.5px solid rgba(239, 68, 68, 0.3)',
                  fontWeight: 500,
                  '&:focus': {
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)',
                  },
                },
              }}
              {...form.getInputProps('applicationDate')}
            />

            <TextInput
              label="Purpose"
              placeholder="Enter loan purpose"
              required
              leftSection={<IconFileText size={18} opacity={0.7} />}
              styles={{
                label: {
                  fontWeight: 600,
                  color: '#fecaca',
                },
                input: {
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  border: '1.5px solid rgba(239, 68, 68, 0.3)',
                  fontWeight: 500,
                  '&:focus': {
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)',
                  },
                  '&::placeholder': {
                    color: 'rgba(255, 255, 255, 0.4)',
                  },
                },
              }}
              {...form.getInputProps('purpose')}
            />

            <Textarea
              label="Notes"
              placeholder="Additional notes (optional)"
              minRows={3}
              leftSection={<IconNote size={18} opacity={0.7} />}
              styles={{
                label: {
                  fontWeight: 600,
                  color: '#fecaca',
                },
                input: {
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  border: '1.5px solid rgba(239, 68, 68, 0.3)',
                  fontWeight: 500,
                  '&:focus': {
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)',
                  },
                  '&::placeholder': {
                    color: 'rgba(255, 255, 255, 0.4)',
                  },
                },
              }}
              {...form.getInputProps('notes')}
            />
          </Stack>
        </Paper>
      </Stack>
    </ComposedDialog>
  );
}

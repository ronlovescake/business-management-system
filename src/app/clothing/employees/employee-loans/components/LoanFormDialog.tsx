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
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Group mb="md" gap="xs">
            <ThemeIcon
              size="lg"
              radius="md"
              variant="light"
              color="#85bd3a"
              style={{ backgroundColor: 'rgba(133, 189, 58, 0.15)' }}
            >
              <IconUser size={20} />
            </ThemeIcon>
            <Text fw={600} size="sm" c="dimmed">
              Applicant Information
            </Text>
          </Group>

          <Grid gutter="md">
            <Grid.Col span={6}>
              <TextInput
                label="Employee Name"
                placeholder="Enter employee name"
                required
                leftSection={<IconUser size={16} opacity={0.5} />}
                styles={{
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    '&:focus': {
                      borderColor: '#85bd3a',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
                leftSection={<IconCategory size={16} opacity={0.5} />}
                data={[
                  { value: 'personal', label: 'Personal Loan' },
                  { value: 'emergency', label: 'Emergency Loan' },
                  { value: 'educational', label: 'Educational Loan' },
                  { value: 'housing', label: 'Housing Loan' },
                  { value: 'vehicle', label: 'Vehicle Loan' },
                ]}
                styles={{
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    '&:focus': {
                      borderColor: '#85bd3a',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Group mb="md" gap="xs">
            <ThemeIcon
              size="lg"
              radius="md"
              variant="light"
              color="#85bd3a"
              style={{ backgroundColor: 'rgba(133, 189, 58, 0.15)' }}
            >
              <IconCash size={20} />
            </ThemeIcon>
            <Text fw={600} size="sm" c="dimmed">
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
                leftSection={<IconCash size={16} opacity={0.5} />}
                styles={{
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: 600,
                    fontSize: '15px',
                    '&:focus': {
                      borderColor: '#85bd3a',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
                leftSection={<IconPercentage size={16} opacity={0.5} />}
                styles={{
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: 600,
                    fontSize: '15px',
                    '&:focus': {
                      borderColor: '#85bd3a',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
                leftSection={<IconCalendar size={16} opacity={0.5} />}
                styles={{
                  input: {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: 600,
                    fontSize: '15px',
                    '&:focus': {
                      borderColor: '#85bd3a',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Group mb="md" gap="xs">
            <ThemeIcon
              size="lg"
              radius="md"
              variant="light"
              color="#85bd3a"
              style={{ backgroundColor: 'rgba(133, 189, 58, 0.15)' }}
            >
              <IconFileText size={20} />
            </ThemeIcon>
            <Text fw={600} size="sm" c="dimmed">
              Additional Details
            </Text>
          </Group>

          <Stack gap="md">
            <TextInput
              label="Application Date"
              type="date"
              required
              leftSection={<IconCalendar size={16} opacity={0.5} />}
              styles={{
                input: {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:focus': {
                    borderColor: '#85bd3a',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  },
                },
              }}
              {...form.getInputProps('applicationDate')}
            />

            <TextInput
              label="Purpose"
              placeholder="Enter loan purpose"
              required
              leftSection={<IconFileText size={16} opacity={0.5} />}
              styles={{
                input: {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:focus': {
                    borderColor: '#85bd3a',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  },
                },
              }}
              {...form.getInputProps('purpose')}
            />

            <Textarea
              label="Notes"
              placeholder="Additional notes (optional)"
              minRows={3}
              leftSection={<IconNote size={16} opacity={0.5} />}
              styles={{
                input: {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:focus': {
                    borderColor: '#85bd3a',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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

import { useEffect } from 'react';
import { TextInput, NumberInput, Textarea, Select } from '@mantine/core';
import { useForm } from '@mantine/form';
import { ComposedDialog } from '@/components/shared/Dialog';
import { EmployeeLoan, EmployeeLoanFormData } from '../types';

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
      size="lg"
      header={{
        title: editingLoan ? 'Edit Loan Application' : 'New Loan Application',
        subtitle: editingLoan
          ? 'Update the loan application details'
          : 'Fill in the details to submit a new loan application',
        iconColor: '#85bd3a',
      }}
      body={{
        padding: 'md',
        maxHeight: '65vh',
      }}
      footer={{
        layout: 'flex-end',
        secondaryButton: {
          label: 'Cancel',
          onClick: onClose,
          variant: 'default',
        },
        primaryButton: {
          label: editingLoan ? 'Update' : 'Submit',
          onClick: handleSave,
          disabled: !form.isValid(),
          color: '#85bd3a',
        },
      }}
    >
      <TextInput
        label="Employee Name"
        placeholder="Enter employee name"
        required
        {...form.getInputProps('employee')}
      />

      <Select
        label="Loan Type"
        placeholder="Select loan type"
        required
        data={[
          { value: 'personal', label: 'Personal Loan' },
          { value: 'emergency', label: 'Emergency Loan' },
          { value: 'educational', label: 'Educational Loan' },
          { value: 'housing', label: 'Housing Loan' },
          { value: 'vehicle', label: 'Vehicle Loan' },
        ]}
        {...form.getInputProps('loanType')}
      />

      <NumberInput
        label="Loan Amount"
        placeholder="Enter loan amount"
        required
        min={0}
        prefix="$"
        decimalScale={2}
        thousandSeparator=","
        hideControls
        value={form.values.amount}
        onChange={(value) =>
          form.setFieldValue('amount', value?.toString() || '')
        }
        error={form.errors.amount}
      />

      <NumberInput
        label="Interest Rate (%)"
        placeholder="Enter annual interest rate"
        required
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
        hideControls
        value={form.values.interestRate}
        onChange={(value) =>
          form.setFieldValue('interestRate', value?.toString() || '')
        }
        error={form.errors.interestRate}
      />

      <NumberInput
        label="Term (Months)"
        placeholder="Enter loan term in months"
        required
        min={1}
        max={360}
        hideControls
        value={form.values.termMonths}
        onChange={(value) =>
          form.setFieldValue('termMonths', value?.toString() || '')
        }
        error={form.errors.termMonths}
      />

      <TextInput
        label="Application Date"
        type="date"
        required
        {...form.getInputProps('applicationDate')}
      />

      <TextInput
        label="Purpose"
        placeholder="Enter loan purpose"
        required
        {...form.getInputProps('purpose')}
      />

      <Textarea
        label="Notes"
        placeholder="Additional notes (optional)"
        minRows={3}
        {...form.getInputProps('notes')}
      />
    </ComposedDialog>
  );
}

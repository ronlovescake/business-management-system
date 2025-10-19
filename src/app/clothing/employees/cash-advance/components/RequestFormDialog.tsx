import { useEffect } from 'react';
import { TextInput, NumberInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { ComposedDialog } from '@/components/shared/Dialog';
import { getCurrentDateISO } from '@/utils/date';
import type { CashAdvance, CashAdvanceFormData } from '../types';

interface RequestFormDialogProps {
  opened: boolean;
  editingRequest: CashAdvance | null;
  onClose: () => void;
  onSave: (data: CashAdvanceFormData) => void;
}

export function RequestFormDialog({
  opened,
  editingRequest,
  onClose,
  onSave,
}: RequestFormDialogProps) {
  const form = useForm<CashAdvanceFormData>({
    initialValues: {
      employee: '',
      amount: '',
      purpose: '',
      terms: '',
      requestDate: getCurrentDateISO(),
      notes: '',
    },
    validate: {
      employee: (value) => (!value ? 'Employee name is required' : null),
      amount: (value) => {
        if (!value) {
          return 'Amount is required';
        }
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Amount must be greater than 0';
        }
        return null;
      },
      purpose: (value) => (!value ? 'Purpose is required' : null),
      terms: (value) => (!value ? 'Terms are required' : null),
      requestDate: (value) => (!value ? 'Request date is required' : null),
    },
  });

  useEffect(() => {
    if (editingRequest) {
      form.setValues({
        employee: editingRequest.employee,
        amount: editingRequest.amount.toString(),
        purpose: editingRequest.purpose,
        terms: editingRequest.terms,
        requestDate: editingRequest.requestDate,
        notes: editingRequest.notes || '',
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRequest, opened]);

  const handleSubmit = (values: CashAdvanceFormData) => {
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
        title: editingRequest
          ? 'Edit Cash Advance Request'
          : 'Add Cash Advance Request',
        subtitle: editingRequest
          ? 'Update the request details below'
          : 'Fill in the details to submit a new cash advance request',
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
          label: editingRequest ? 'Update' : 'Submit',
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

      <NumberInput
        label="Amount"
        placeholder="Enter amount"
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

      <TextInput
        label="Purpose"
        placeholder="Enter purpose of advance"
        required
        {...form.getInputProps('purpose')}
      />

      <TextInput
        label="Terms"
        placeholder="e.g., 6 months installment"
        required
        {...form.getInputProps('terms')}
      />

      <TextInput
        label="Request Date"
        type="date"
        required
        {...form.getInputProps('requestDate')}
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

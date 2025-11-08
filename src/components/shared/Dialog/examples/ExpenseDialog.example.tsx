/**
 * Example: Expense Form Dialog
 *
 * This shows how to convert the existing "Add New Expense" modal
 * to use the new reusable Dialog component.
 */

import { useState } from 'react';
import {
  Stack,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  FileButton,
  Button,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconReceipt } from '@tabler/icons-react';
import { ComposedDialog } from '@/components/shared/Dialog';
import { FormatterService } from '@/services/FormatterService';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';

// Example Expense type
interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string;
  receipt: string | null;
}

interface ExpenseDialogProps {
  opened: boolean;
  onClose: () => void;
  expense: Expense | null; // null = add new, not null = edit existing
  categories: string[];
  onSave: (data: {
    date: string;
    amount: number;
    description: string;
    category: string;
    notes: string;
    receipt: File | null;
  }) => void;
}

export function ExpenseDialog({
  opened,
  onClose,
  expense,
  categories,
  onSave,
}: ExpenseDialogProps) {
  // Form state
  const [formDate, setFormDate] = useState(expense?.date || '');
  const [formAmount, setFormAmount] = useState<number | ''>(
    expense?.amount || ''
  );
  const [formDescription, setFormDescription] = useState(
    expense?.description || ''
  );
  const [formCategory, setFormCategory] = useState(expense?.category || '');
  const [formNotes, setFormNotes] = useState(expense?.notes || '');
  const [formReceipt, setFormReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Validation
  const isValid = formDate && formAmount && formDescription && formCategory;

  const handleSave = async () => {
    if (!isValid) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        date: formDate,
        amount: Number(formAmount),
        description: formDescription,
        category: formCategory,
        notes: formNotes,
        receipt: formReceipt,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setFormDate('');
    setFormAmount('');
    setFormDescription('');
    setFormCategory('');
    setFormNotes('');
    setFormReceipt(null);
    onClose();
  };

  return (
    <ComposedDialog
      opened={opened}
      onClose={handleClose}
      size="lg"
      header={{
        title: expense ? 'Edit Expense' : 'Add New Expense',
        subtitle: expense
          ? 'Update the expense details below'
          : 'Fill in the details below',
        icon: <IconReceipt size={24} />,
        iconColor: 'green',
      }}
      body={{
        padding: 'md',
        maxHeight: '65vh', // Scrollable if form is long
      }}
      footer={{
        layout: 'flex-end',
        secondaryButton: {
          label: 'Cancel',
          onClick: handleClose,
          variant: 'default',
        },
        primaryButton: {
          label: expense ? 'Update Expense' : 'Add Expense',
          onClick: handleSave,
          loading: saving,
          disabled: !isValid,
          color: 'green',
        },
      }}
    >
      <Stack gap="md">
        <DateInput
          label="Date"
          required
          value={parseDateValue(formDate)}
          onChange={(value) => setFormDate(formatDateForInput(value))}
          description="When was this expense made?"
          valueFormat="MM/DD/YYYY"
          clearable
          {...COMMON_DATE_INPUT_PROPS}
        />

        <NumberInput
          label="Amount"
          required
          placeholder="0.00"
          decimalScale={2}
          fixedDecimalScale
          prefix={`${FormatterService.currencySymbol} `}
          value={formAmount}
          onChange={(value) => setFormAmount(value as number | '')}
          description="Enter the expense amount"
        />

        <TextInput
          label="Description"
          required
          placeholder="Brief description"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          description="What was this expense for?"
        />

        <Select
          label="Category"
          required
          placeholder="Select category"
          data={categories}
          value={formCategory}
          onChange={(value) => setFormCategory(value || '')}
          searchable
          description="Choose the expense category"
        />

        <Textarea
          label="Notes (Optional)"
          placeholder="Additional details"
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          minRows={3}
          description="Add any additional notes or details"
        />

        <FileButton onChange={setFormReceipt} accept="image/*,.pdf">
          {(props) => (
            <Button
              {...props}
              variant="light"
              fullWidth
              leftSection={<IconReceipt size={16} />}
            >
              {formReceipt ? formReceipt.name : 'Upload Receipt (Optional)'}
            </Button>
          )}
        </FileButton>
      </Stack>
    </ComposedDialog>
  );
}

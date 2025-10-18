/**
 * Expense Form Dialog Component
 *
 * Converted to use the new modular Dialog component system.
 * This replaces the old Modal implementation with a reusable,
 * consistent dialog that matches the design system.
 */

'use client';

import {
  Stack,
  Text,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  FileButton,
  Button,
  Group,
} from '@mantine/core';
import { IconReceipt } from '@tabler/icons-react';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';

interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string;
  receipt: string | null;
  status: 'pending' | 'approved' | 'rejected';
  employeeName?: string;
}

interface ExpenseFormDialogProps {
  opened: boolean;
  onClose: () => void;
  editingExpense: Expense | null;
  categories: string[];

  // Form state
  formDate: string;
  setFormDate: (date: string) => void;
  formAmount: number | '';
  setFormAmount: (amount: number | '') => void;
  formDescription: string;
  setFormDescription: (description: string) => void;
  formCategory: string;
  setFormCategory: (category: string) => void;
  formTripId: string;
  setFormTripId: (tripId: string) => void;
  formNotes: string;
  setFormNotes: (notes: string) => void;
  formReceipt: File | null;
  setFormReceipt: (file: File | null) => void;

  // Actions
  onSave: () => void;
}

export function ExpenseFormDialog({
  opened,
  onClose,
  editingExpense,
  categories,
  formDate,
  setFormDate,
  formAmount,
  setFormAmount,
  formDescription,
  setFormDescription,
  formCategory,
  setFormCategory,
  formTripId,
  setFormTripId,
  formNotes,
  setFormNotes,
  formReceipt,
  setFormReceipt,
  onSave,
}: ExpenseFormDialogProps) {
  // Validation
  const isValid = formDate && formAmount && formDescription && formCategory;

  const { getFieldProps, getTextareaProps, getSelectProps } =
    usePolishedFieldStyles(opened);

  const dateField = getFieldProps('date');
  const categorySelect = getSelectProps('category');
  const amountField = getFieldProps('amount');
  const tripIdField = getFieldProps('tripId');
  const descriptionField = getFieldProps('description');
  const notesField = getTextareaProps('notes');

  const modalTitle = (
    <Group gap="sm" align="center">
      <IconReceipt size={26} color="#65ab58" />
      <Stack gap={2}>
        <Text fw={700} fz="lg" c="#101828">
          {editingExpense ? 'Edit Expense' : 'Add New Expense'}
        </Text>
        <Text fz="sm" c="#667085">
          {editingExpense
            ? 'Update the expense details below'
            : 'Fill in the details to add a new expense'}
        </Text>
      </Stack>
    </Group>
  );

  return (
    <PolishedModal
      opened={opened}
      onClose={onClose}
      title={modalTitle}
      size="lg"
    >
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        <Stack gap="lg">
          <Group grow align="flex-start">
            <TextInput
              label="Date"
              placeholder="MM/DD/YYYY"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
              {...dateField.handlers}
              styles={dateField.styles}
            />
            <Select
              label="Category"
              placeholder="Select category"
              data={categories}
              value={formCategory}
              onChange={(value) => setFormCategory(value || '')}
              required
              searchable
              {...categorySelect.handlers}
              styles={categorySelect.styles}
              withCheckIcon={false}
              comboboxProps={{ withinPortal: true, zIndex: 500 }}
            />
          </Group>

          <Group grow align="flex-start">
            <NumberInput
              label="Amount"
              placeholder="0"
              prefix="₱ "
              decimalScale={2}
              value={formAmount}
              onChange={(value) =>
                setFormAmount(typeof value === 'number' ? value : '')
              }
              required
              min={0}
              {...amountField.handlers}
              styles={amountField.styles}
            />
            <TextInput
              label="Trip ID (Optional)"
              placeholder="e.g., TRP-001"
              value={formTripId}
              onChange={(e) => setFormTripId(e.target.value)}
              {...tripIdField.handlers}
              styles={tripIdField.styles}
            />
          </Group>

          <TextInput
            label="Description"
            placeholder="Brief description of the expense"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            required
            {...descriptionField.handlers}
            styles={descriptionField.styles}
          />

          <Textarea
            label="Notes (Optional)"
            placeholder="Additional details or notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            minRows={3}
            {...notesField.handlers}
            styles={notesField.styles}
          />

          <FileButton
            onChange={setFormReceipt}
            accept="image/*,application/pdf"
          >
            {(props) => (
              <Button
                {...props}
                fullWidth
                leftSection={<IconReceipt size={16} />}
                radius="md"
                styles={polishedPrimaryButtonStyles}
              >
                {formReceipt
                  ? `Selected: ${formReceipt.name}`
                  : 'Click to upload receipt (Optional)'}
              </Button>
            )}
          </FileButton>

          <Group justify="flex-end" gap="sm" mt="sm">
            <Button radius="md" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              radius="md"
              onClick={onSave}
              disabled={!isValid}
              styles={polishedPrimaryButtonStyles}
            >
              {editingExpense ? 'Update Expense' : 'Add Expense'}
            </Button>
          </Group>
        </Stack>
      </div>
    </PolishedModal>
  );
}

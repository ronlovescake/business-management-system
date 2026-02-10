/**
 * Expense Form Dialog Component
 *
 * Converted to use the new modular Dialog component system.
 * This replaces the old Modal implementation with a reusable,
 * consistent dialog that matches the design system.
 */

'use client';

import React from 'react';
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
import { DateInput } from '@mantine/dates';
import { IconReceipt } from '@tabler/icons-react';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { toDate, toISODate } from '@/utils/date';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string;
  receipt: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  employeeName?: string;
}

interface ExpenseFormDialogProps {
  opened: boolean;
  onClose: () => void;
  editingExpense: Expense | null;
  categories: string[];
  addTitle?: string;
  editTitle?: string;
  addSubtitle?: string;
  editSubtitle?: string;

  // Form state
  formDate: string;
  setFormDate: (date: string) => void;
  formAmount: number | '';
  setFormAmount: (amount: number | '') => void;
  formDescription: string;
  setFormDescription: (description: string) => void;
  formCategory: string;
  setFormCategory: (category: string) => void;
  accountOptions?: Array<{ value: string; label: string }>;
  formAccountId?: string | null;
  setFormAccountId?: (accountId: string | null) => void;
  formTripId?: string;
  setFormTripId?: (tripId: string) => void;
  formNotes: string;
  setFormNotes: (notes: string) => void;
  formReceipt: File | null;
  setFormReceipt: (file: File | null) => void;
  showTripId?: boolean;

  // Actions
  onSave: () => void;
  onSaveAndAddNew?: () => void;
}

export const ExpenseFormDialog = React.memo(function ExpenseFormDialog({
  opened,
  onClose,
  editingExpense,
  categories,
  addTitle = 'Add New Expense',
  editTitle = 'Edit Expense',
  addSubtitle = 'Fill in the details to add a new expense',
  editSubtitle = 'Update the expense details below',
  formDate,
  setFormDate,
  formAmount,
  setFormAmount,
  formDescription,
  setFormDescription,
  formCategory,
  setFormCategory,
  accountOptions,
  formAccountId = null,
  setFormAccountId = (_accountId: string | null) => {},
  formTripId = '',
  setFormTripId = (_tripId: string) => {},
  formNotes,
  setFormNotes,
  formReceipt,
  setFormReceipt,
  showTripId = true,
  onSave,
  onSaveAndAddNew,
}: ExpenseFormDialogProps) {
  // Validation
  const isValid = Boolean(
    formDate &&
      formAmount &&
      formDescription &&
      formCategory &&
      (!accountOptions || formAccountId)
  );

  const { getFieldProps, getTextareaProps, getSelectProps } =
    usePolishedFieldStyles(opened);

  const dateField = getFieldProps('date');
  const categorySelect = getSelectProps('category');
  const amountField = getFieldProps('amount');
  const accountSelect = accountOptions ? getSelectProps('account') : null;
  const tripIdField = showTripId ? getFieldProps('tripId') : null;
  const descriptionField = getFieldProps('description');
  const notesField = getTextareaProps('notes');

  const titleText = editingExpense ? editTitle : addTitle;
  const subtitleText = editingExpense ? editSubtitle : addSubtitle;

  return (
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title={titleText}
      size="lg"
    >
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        <Stack gap="lg">
          <Text size="sm" c="dimmed" style={{ textAlign: 'center' }}>
            {subtitleText}
          </Text>
          <Group grow align="flex-start">
            <DateInput
              label="Date"
              required
              value={toDate(formDate)}
              onChange={(value) => setFormDate(toISODate(value))}
              {...dateField.handlers}
              styles={dateField.styles}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <Select
              label="Category"
              data={categories}
              value={formCategory}
              onChange={(value) => setFormCategory(value || '')}
              required
              searchable
              maxDropdownHeight={400}
              {...categorySelect.handlers}
              styles={categorySelect.styles}
              withCheckIcon={false}
              comboboxProps={{ withinPortal: true, zIndex: 500 }}
            />
          </Group>

          <Group grow align="flex-start">
            <NumberInput
              label="Amount"
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
            {accountOptions && (
              <Select
                label="Account"
                data={accountOptions}
                value={formAccountId}
                onChange={(value) => setFormAccountId(value || null)}
                searchable
                required
                maxDropdownHeight={400}
                {...(accountSelect ? accountSelect.handlers : {})}
                styles={accountSelect?.styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            )}
            {showTripId && (
              <TextInput
                label="Trip ID (Optional)"
                value={formTripId}
                onChange={(e) => setFormTripId(e.target.value)}
                {...(tripIdField ? tripIdField.handlers : {})}
                styles={tripIdField?.styles}
              />
            )}
          </Group>

          <TextInput
            label="Description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            required
            {...descriptionField.handlers}
            styles={descriptionField.styles}
          />

          <Textarea
            label="Notes (Optional)"
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
                variant="default"
              >
                {formReceipt
                  ? `Selected: ${formReceipt.name}`
                  : 'Click to upload receipt (Optional)'}
              </Button>
            )}
          </FileButton>

          <Group justify="flex-end" gap="sm" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            {!editingExpense && onSaveAndAddNew && (
              // =================================================================
              // ⚠️ SAVE + ADD NEW
              // =================================================================
              // Keeps the modal open and clears the form after creating.
              // =================================================================
              <Button
                variant="default"
                onClick={onSaveAndAddNew}
                disabled={!isValid}
              >
                Save and add new
              </Button>
            )}
            <Button onClick={onSave} disabled={!isValid}>
              {editingExpense ? 'Update Expense' : 'Add Expense'}
            </Button>
          </Group>
        </Stack>
      </div>
    </UniversalModal>
  );
});

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
  TextInput,
  NumberInput,
  Select,
  Textarea,
  FileButton,
  Button,
  Group,
} from '@mantine/core';
import { IconReceipt } from '@tabler/icons-react';
import { ComposedDialog } from '@/components/shared/Dialog';

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

  return (
    <ComposedDialog
      opened={opened}
      onClose={onClose}
      size="lg"
      header={{
        title: editingExpense ? 'Edit Expense' : 'Add New Expense',
        subtitle: editingExpense
          ? 'Update the expense details below'
          : 'Fill in the details to add a new expense',
        icon: <IconReceipt size={24} />,
        iconColor: '#85bd3a',
      }}
      body={{
        padding: 'md',
        maxHeight: '65vh', // Scrollable if content is long
      }}
      footer={{
        layout: 'flex-end',
        secondaryButton: {
          label: 'Cancel',
          onClick: onClose,
          variant: 'default',
        },
        primaryButton: {
          label: editingExpense ? 'Update Expense' : 'Add Expense',
          onClick: onSave,
          disabled: !isValid,
          color: '#85bd3a',
        },
      }}
    >
      <Stack gap="md">
        {/* Date and Category Row */}
        <Group grow align="flex-start">
          <TextInput
            label="Date"
            placeholder="MM/DD/YYYY"
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            required
            radius="md"
            size="md"
            styles={{
              label: {
                fontWeight: 500,
                fontSize: '0.875rem',
                marginBottom: '0.5rem',
              },
              input: {
                borderColor: '#d0d7de',
                '&:focus': {
                  borderColor: '#2188ff',
                },
              },
            }}
          />
          <Select
            label="Category"
            placeholder="Select category"
            data={categories}
            value={formCategory}
            onChange={(value) => setFormCategory(value || '')}
            required
            searchable
            radius="md"
            size="md"
            styles={{
              label: {
                fontWeight: 500,
                fontSize: '0.875rem',
                marginBottom: '0.5rem',
              },
              input: {
                borderColor: '#d0d7de',
                '&:focus': {
                  borderColor: '#2188ff',
                },
              },
            }}
          />
        </Group>

        {/* Amount and Trip ID Row */}
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
            radius="md"
            size="md"
            styles={{
              label: {
                fontWeight: 500,
                fontSize: '0.875rem',
                marginBottom: '0.5rem',
              },
              input: {
                borderColor: '#d0d7de',
                '&:focus': {
                  borderColor: '#2188ff',
                },
              },
            }}
          />
          <TextInput
            label="Trip ID (Optional)"
            placeholder="e.g., TRP-001"
            value={formTripId}
            onChange={(e) => setFormTripId(e.target.value)}
            radius="md"
            size="md"
            styles={{
              label: {
                fontWeight: 500,
                fontSize: '0.875rem',
                marginBottom: '0.5rem',
              },
              input: {
                borderColor: '#d0d7de',
                '&:focus': {
                  borderColor: '#2188ff',
                },
              },
            }}
          />
        </Group>

        {/* Description */}
        <TextInput
          label="Description"
          placeholder="Brief description of the expense"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          required
          radius="md"
          size="md"
          styles={{
            label: {
              fontWeight: 500,
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
            },
            input: {
              borderColor: '#d0d7de',
              '&:focus': {
                borderColor: '#2188ff',
              },
            },
          }}
        />

        {/* Notes */}
        <Textarea
          label="Notes (Optional)"
          placeholder="Additional details or notes"
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          minRows={3}
          radius="md"
          size="md"
          styles={{
            label: {
              fontWeight: 500,
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
            },
            input: {
              borderColor: '#d0d7de',
              '&:focus': {
                borderColor: '#2188ff',
              },
            },
          }}
        />

        {/* Receipt Upload */}
        <FileButton onChange={setFormReceipt} accept="image/*,application/pdf">
          {(props) => (
            <Button
              {...props}
              variant="light"
              color="#85bd3a"
              fullWidth
              leftSection={<IconReceipt size={16} />}
              radius="md"
              size="md"
            >
              {formReceipt
                ? `Selected: ${formReceipt.name}`
                : 'Click to upload receipt (Optional)'}
            </Button>
          )}
        </FileButton>
      </Stack>
    </ComposedDialog>
  );
}

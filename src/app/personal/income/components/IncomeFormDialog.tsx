'use client';

import React from 'react';
import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';

export type PersonalIncomeType =
  | 'BUSINESS_DRAW'
  | 'SALARY'
  | 'FREELANCE'
  | 'GIFT'
  | 'REFUND'
  | 'OTHER';

export interface PersonalIncomeDraft {
  date: string; // yyyy-mm-dd
  type: PersonalIncomeType;
  amount: number;
  account: string;
  notes: string;
}

interface IncomeFormDialogProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  description: string;
  initial: PersonalIncomeDraft;
  onChange: (next: PersonalIncomeDraft) => void;
  onSave: () => void;
}

const INCOME_TYPE_OPTIONS: Array<{ value: PersonalIncomeType; label: string }> =
  [
    { value: 'BUSINESS_DRAW', label: 'Business Draw' },
    { value: 'SALARY', label: 'Salary' },
    { value: 'FREELANCE', label: 'Freelance' },
    { value: 'GIFT', label: 'Gift' },
    { value: 'REFUND', label: 'Refund' },
    { value: 'OTHER', label: 'Other' },
  ];

export const IncomeFormDialog = React.memo(function IncomeFormDialog({
  opened,
  onClose,
  title,
  description,
  initial,
  onChange,
  onSave,
}: IncomeFormDialogProps) {
  const isValid =
    initial.date.trim().length > 0 &&
    Number.isFinite(initial.amount) &&
    initial.amount > 0 &&
    initial.type.length > 0;

  const { getFieldProps, getSelectProps, getAutosizeTextareaProps } =
    usePolishedFieldStyles(opened);

  const dateField = getFieldProps('incomeDate');
  const typeField = getSelectProps('incomeType');
  const amountField = getFieldProps('incomeAmount');
  const accountField = getFieldProps('incomeAccount');
  const notesField = getAutosizeTextareaProps('incomeNotes');

  return (
    <PolishedModal opened={opened} onClose={onClose} title={title} size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {description}
        </Text>

        <Group grow align="flex-start">
          <TextInput
            label="Date"
            type="date"
            value={initial.date}
            onChange={(e) => onChange({ ...initial, date: e.target.value })}
            required
            {...dateField.handlers}
            styles={dateField.styles}
          />

          <Select
            label="Income Type"
            data={INCOME_TYPE_OPTIONS}
            value={initial.type}
            onChange={(value) =>
              onChange({
                ...initial,
                type: (value as PersonalIncomeType) || 'BUSINESS_DRAW',
              })
            }
            required
            {...typeField.handlers}
            styles={typeField.styles}
            comboboxProps={{ withinPortal: true, zIndex: 500 }}
          />
        </Group>

        <NumberInput
          label="Amount"
          placeholder="0.00"
          value={Number.isFinite(initial.amount) ? initial.amount : 0}
          onChange={(value) =>
            onChange({
              ...initial,
              amount: typeof value === 'number' ? value : 0,
            })
          }
          min={0}
          step={1}
          thousandSeparator=","
          decimalScale={2}
          fixedDecimalScale
          required
          {...amountField.handlers}
          styles={amountField.styles}
        />

        <TextInput
          label="Account (Optional)"
          placeholder="e.g., Cash Wallet / GCash - Ron"
          value={initial.account}
          onChange={(e) => onChange({ ...initial, account: e.target.value })}
          {...accountField.handlers}
          styles={accountField.styles}
        />

        <Textarea
          label="Notes (Optional)"
          placeholder="Any details you want to remember…"
          value={initial.notes}
          onChange={(e) => onChange({ ...initial, notes: e.target.value })}
          autosize
          minRows={3}
          {...notesField.handlers}
          styles={notesField.styles}
        />

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
            Save Income
          </Button>
        </Group>
      </Stack>
    </PolishedModal>
  );
});

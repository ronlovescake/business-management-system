'use client';

import React from 'react';
import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { UniversalModal } from '@/components/modals/UniversalModal';

import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';

export type PersonalIncomeType =
  | 'BUSINESS_DRAW'
  | 'SALARY'
  | 'FREELANCE'
  | 'GIFT'
  | 'CASHBACK'
  | 'REFUND'
  | 'OTHER';

export interface PersonalIncomeDraft {
  date: string; // yyyy-mm-dd
  type: PersonalIncomeType;
  amount: number;
  account: string;
  accountId?: string | null;
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
  accountOptions?: Array<{ value: string; label: string }>;
}

const INCOME_TYPE_OPTIONS: Array<{ value: PersonalIncomeType; label: string }> =
  [
    { value: 'BUSINESS_DRAW', label: 'Business Draw' },
    { value: 'SALARY', label: 'Salary' },
    { value: 'FREELANCE', label: 'Freelance' },
    { value: 'GIFT', label: 'Gift' },
    { value: 'CASHBACK', label: 'Cashback' },
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
  accountOptions = [],
}: IncomeFormDialogProps) {
  const isValid =
    initial.date.trim().length > 0 &&
    Number.isFinite(initial.amount) &&
    initial.amount > 0 &&
    initial.type.length > 0 &&
    Boolean(initial.accountId);

  const { getFieldProps, getSelectProps, getAutosizeTextareaProps } =
    usePolishedFieldStyles(opened);

  const dateField = getFieldProps('incomeDate');
  const typeField = getSelectProps('incomeType');
  const amountField = getFieldProps('incomeAmount');
  const accountField = getFieldProps('incomeAccount');
  const notesField = getAutosizeTextareaProps('incomeNotes');

  return (
    <UniversalModal opened={opened} onClose={onClose} title={title} size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {description}
        </Text>

        <Group grow align="flex-start">
          <DateInput
            label="Date"
            value={parseDateValue(initial.date)}
            onChange={(value) =>
              onChange({ ...initial, date: formatDateForInput(value) })
            }
            required
            {...COMMON_DATE_INPUT_PROPS}
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

        <Select
          label="Account"
          placeholder="Select an account"
          data={accountOptions}
          value={initial.accountId ?? null}
          onChange={(value) => {
            const selected = accountOptions.find((o) => o.value === value);
            onChange({
              ...initial,
              accountId: value || null,
              account: selected?.label || '',
            });
          }}
          searchable
          required
          {...accountField.handlers}
          styles={accountField.styles}
          comboboxProps={{ withinPortal: true, zIndex: 500 }}
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
          <Button radius="md" onClick={onSave} disabled={!isValid}>
            Save Income
          </Button>
        </Group>
      </Stack>
    </UniversalModal>
  );
});

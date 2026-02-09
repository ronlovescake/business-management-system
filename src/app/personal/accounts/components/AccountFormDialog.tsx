'use client';

import React from 'react';
import { Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { UniversalModal } from '@/components/modals/UniversalModal';

import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';

export type PersonalAccountType =
  | 'CASH'
  | 'BANK'
  | 'EWALLET'
  | 'CREDIT_CARD'
  | 'LOAN';

export interface PersonalAccountDraft {
  name: string;
  type: PersonalAccountType;
  institution: string;
  accountNumberLast4: string;
}

interface AccountFormDialogProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  description: string;
  initial: PersonalAccountDraft;
  onChange: (next: PersonalAccountDraft) => void;
  onSave: () => void;
}

const ACCOUNT_TYPE_OPTIONS: Array<{
  value: PersonalAccountType;
  label: string;
}> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank' },
  { value: 'EWALLET', label: 'E-wallet' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'LOAN', label: 'Loan' },
];

export const AccountFormDialog = React.memo(function AccountFormDialog({
  opened,
  onClose,
  title,
  description,
  initial,
  onChange,
  onSave,
}: AccountFormDialogProps) {
  const isValid = initial.name.trim().length > 0;

  const { getFieldProps, getSelectProps } = usePolishedFieldStyles(opened);

  const nameField = getFieldProps('accountName');
  const typeField = getSelectProps('accountType');
  const institutionField = getFieldProps('accountInstitution');
  const last4Field = getFieldProps('accountLast4');

  return (
    <UniversalModal opened={opened} onClose={onClose} title={title} size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {description}
        </Text>

        <TextInput
          label="Account Name"
          placeholder="e.g., GCash - Ron"
          value={initial.name}
          onChange={(e) => onChange({ ...initial, name: e.target.value })}
          required
          {...nameField.handlers}
          styles={nameField.styles}
        />

        <Select
          label="Account Type"
          data={ACCOUNT_TYPE_OPTIONS}
          value={initial.type}
          onChange={(value) =>
            onChange({
              ...initial,
              type: (value as PersonalAccountType) || 'CASH',
            })
          }
          required
          {...typeField.handlers}
          styles={typeField.styles}
          comboboxProps={{ withinPortal: true, zIndex: 500 }}
        />

        <Group grow align="flex-start">
          <TextInput
            label="Institution (Optional)"
            placeholder="e.g., BPI / BDO / GCash"
            value={initial.institution}
            onChange={(e) =>
              onChange({ ...initial, institution: e.target.value })
            }
            {...institutionField.handlers}
            styles={institutionField.styles}
          />
          <TextInput
            label="Last 4 Digits (Optional)"
            placeholder="e.g., 1234"
            value={initial.accountNumberLast4}
            onChange={(e) =>
              onChange({ ...initial, accountNumberLast4: e.target.value })
            }
            {...last4Field.handlers}
            styles={last4Field.styles}
          />
        </Group>

        <Group justify="flex-end" gap="sm" mt="sm">
          <Button radius="md" variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button radius="md" onClick={onSave} disabled={!isValid}>
            Save Account
          </Button>
        </Group>
      </Stack>
    </UniversalModal>
  );
});

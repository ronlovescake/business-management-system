import {
  Modal,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Group,
  Stack,
  Button,
  Text,
} from '@mantine/core';

export type OpeningBalanceEntryForm = {
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
};

interface OpeningBalanceEntryModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  form: OpeningBalanceEntryForm;
  onChange: (
    field: keyof OpeningBalanceEntryForm,
    value: string | number | null
  ) => void;
  accounts: string[];
  isEditing?: boolean;
}

export function OpeningBalanceEntryModal({
  opened,
  onClose,
  onSubmit,
  isSaving,
  form,
  onChange,
  accounts,
  isEditing = false,
}: OpeningBalanceEntryModalProps) {
  const accountOptions = Array.from(
    new Set([
      ...accounts,
      'Cash',
      'Inventory',
      'Stock on Hand',
      'Inventory in Transit',
      'Opening Equity',
      'Accounts Receivable',
      'Accounts Payable',
      'Loan Payable',
      'Loan Payable – Esquire Loan 1',
      'Loan Payable – Esquire Loan 2',
    ])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? 'Edit Opening Entry' : 'Add Opening Entry'}
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          label="Date"
          type="date"
          value={form.date}
          onChange={(event) => onChange('date', event.currentTarget.value)}
          min="2026-01-01"
          max="2026-01-01"
          disabled
        />

        {!isEditing && (
          <Text size="sm" c="dimmed">
            This creates two opening balance lines on 2026-01-01 (one debit, one
            credit).
          </Text>
        )}

        <TextInput
          label="Reference"
          placeholder="OPENING"
          value={form.ref}
          onChange={(event) => onChange('ref', event.currentTarget.value)}
        />

        {isEditing ? (
          <>
            <Select
              label="Account"
              placeholder="Select account"
              data={accountOptions}
              value={form.account}
              searchable
              clearable
              onChange={(value) => onChange('account', value || '')}
            />

            <Group grow>
              <NumberInput
                label="Debit (₱)"
                thousandSeparator=","
                decimalSeparator="."
                value={form.debit}
                min={0}
                onChange={(value) => onChange('debit', value ?? 0)}
                hideControls
                placeholder="0.00"
              />
              <NumberInput
                label="Credit (₱)"
                thousandSeparator=","
                decimalSeparator="."
                value={form.credit}
                min={0}
                onChange={(value) => onChange('credit', value ?? 0)}
                hideControls
                placeholder="0.00"
              />
            </Group>
          </>
        ) : (
          <>
            <Group grow>
              <Select
                label="Debit Account"
                placeholder="Select account"
                data={accountOptions}
                value={form.debitAccount}
                searchable
                clearable
                onChange={(value) => onChange('debitAccount', value || '')}
              />
              <Select
                label="Credit Account"
                placeholder="Select account"
                data={accountOptions}
                value={form.creditAccount}
                searchable
                clearable
                onChange={(value) => onChange('creditAccount', value || '')}
              />
            </Group>

            <NumberInput
              label="Amount (₱)"
              thousandSeparator=","
              decimalSeparator="."
              value={form.amount}
              min={0}
              onChange={(value) => onChange('amount', value ?? 0)}
              hideControls
              placeholder="0.00"
            />
          </>
        )}

        <Textarea
          label="Description"
          minRows={2}
          autosize
          placeholder="Optional notes"
          value={form.description}
          onChange={(event) =>
            onChange('description', event.currentTarget.value)
          }
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button color="green" onClick={onSubmit} loading={isSaving}>
            {isEditing ? 'Update Opening Entry' : 'Save Opening Entry'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

import {
  Modal,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Group,
  Stack,
  Button,
} from '@mantine/core';

export type ManualJournalEntryForm = {
  date: string;
  ref: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
};

interface ManualJournalEntryModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  form: ManualJournalEntryForm;
  onChange: (
    field: keyof ManualJournalEntryForm,
    value: string | number | null
  ) => void;
  accounts: string[];
  title?: string;
}

export function ManualJournalEntryModal({
  opened,
  onClose,
  onSubmit,
  isSaving,
  form,
  onChange,
  accounts,
  title = 'Add Entry',
}: ManualJournalEntryModalProps) {
  const accountOptions = Array.from(
    new Set([
      ...accounts,
      'Cash',
      'Accounts Receivable',
      'Stock on Hand',
      'Inventory in Transit',
      'Accounts Payable',
      'Opening Equity',
      'Sales Revenue',
      'Sales Returns',
      'COGS',
      'Inventory Shrinkage',
    ])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg">
      <Stack gap="md">
        <TextInput
          label="Date"
          type="date"
          value={form.date}
          onChange={(event) => onChange('date', event.currentTarget.value)}
          min="2026-01-01"
        />

        <TextInput
          label="Reference"
          placeholder="e.g., PAYMENT • Jeh Aguisanda"
          value={form.ref}
          onChange={(event) => onChange('ref', event.currentTarget.value)}
        />

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
            Save Entry
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

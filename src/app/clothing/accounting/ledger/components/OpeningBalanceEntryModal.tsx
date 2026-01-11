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

export type OpeningBalanceEntryForm = {
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
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
}

export function OpeningBalanceEntryModal({
  opened,
  onClose,
  onSubmit,
  isSaving,
  form,
  onChange,
  accounts,
}: OpeningBalanceEntryModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Opening Entry"
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          label="Date"
          type="date"
          value={form.date}
          onChange={(event) => onChange('date', event.currentTarget.value)}
          max="2026-01-01"
        />

        <Group grow>
          <TextInput
            label="Reference"
            placeholder="OPENING"
            value={form.ref}
            onChange={(event) => onChange('ref', event.currentTarget.value)}
          />
          <Select
            label="Account"
            placeholder="Select account"
            data={accounts}
            value={form.account}
            searchable
            clearable
            onChange={(value) => onChange('account', value || '')}
          />
        </Group>

        <Group grow>
          <NumberInput
            label="Debit (₱)"
            thousandSeparator=","
            decimalSeparator="."
            precision={2}
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
            precision={2}
            value={form.credit}
            min={0}
            onChange={(value) => onChange('credit', value ?? 0)}
            hideControls
            placeholder="0.00"
          />
        </Group>

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
            Save Opening Entry
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

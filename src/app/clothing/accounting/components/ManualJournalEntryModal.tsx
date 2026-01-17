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

import {
  collapseTaggableAccountsForOptions,
  isTaggableAccountParent,
  type TaggableAccountParent,
} from '@/lib/accounting/account-tagging';

export type ManualJournalEntryForm = {
  date: string;
  ref: string;
  debitAccount: string;
  creditAccount: string;
  debitAccountTag: string;
  creditAccountTag: string;
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
  const accountOptions = collapseTaggableAccountsForOptions(
    Array.from(
      new Set([
        ...accounts,
        'Cash',
        // Bank/GCash/E-Wallet are treated as cash equivalents.
        'Accounts Receivable',
        'Stock on Hand',
        'Inventory in Transit',
        'Accounts Payable',
        'Credit Card Payable',
        'Loan Payable',
        'Opening Equity',
        'Owner Draw',
        'Sales Revenue',
        'Sales Returns',
        'COGS',
        'Inventory Shrinkage',
        'Interest Expense',
      ])
    )
  );

  const accountOptionData = accountOptions.map((account) =>
    account === 'Cash'
      ? { value: 'Cash', label: 'Cash (Bank + GCash)' }
      : account
  );

  const debitTaggableParent: TaggableAccountParent | null =
    isTaggableAccountParent(form.debitAccount) ? form.debitAccount : null;
  const creditTaggableParent: TaggableAccountParent | null =
    isTaggableAccountParent(form.creditAccount) ? form.creditAccount : null;

  const tagHelperText = (parent: TaggableAccountParent) => {
    const label = parent === 'Loan Payable' ? 'Loan' : 'Vendor / AP';
    return `This will post to “${parent} – <${label}>” on the ledger.`;
  };

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
            data={accountOptionData}
            value={form.debitAccount}
            searchable
            clearable
            onChange={(value) => onChange('debitAccount', value || '')}
          />
          <Select
            label="Credit Account"
            placeholder="Select account"
            data={accountOptionData}
            value={form.creditAccount}
            searchable
            clearable
            onChange={(value) => onChange('creditAccount', value || '')}
          />
        </Group>

        {(debitTaggableParent || creditTaggableParent) && (
          <Group grow>
            {debitTaggableParent ? (
              <Stack gap={4}>
                <TextInput
                  label={
                    form.debitAccount === 'Loan Payable'
                      ? 'Loan Tag'
                      : 'Accounts Payable Tag'
                  }
                  placeholder={
                    form.debitAccount === 'Loan Payable'
                      ? 'e.g., Esquire Loan 1'
                      : 'e.g., Supplier Name'
                  }
                  value={form.debitAccountTag}
                  onChange={(event) =>
                    onChange('debitAccountTag', event.currentTarget.value)
                  }
                />
                <Text size="xs" c="dimmed">
                  {tagHelperText(debitTaggableParent)}
                </Text>
              </Stack>
            ) : (
              <div />
            )}

            {creditTaggableParent ? (
              <Stack gap={4}>
                <TextInput
                  label={
                    form.creditAccount === 'Loan Payable'
                      ? 'Loan Tag'
                      : 'Accounts Payable Tag'
                  }
                  placeholder={
                    form.creditAccount === 'Loan Payable'
                      ? 'e.g., Esquire Loan 1'
                      : 'e.g., Supplier Name'
                  }
                  value={form.creditAccountTag}
                  onChange={(event) =>
                    onChange('creditAccountTag', event.currentTarget.value)
                  }
                />
                <Text size="xs" c="dimmed">
                  {tagHelperText(creditTaggableParent)}
                </Text>
              </Stack>
            ) : (
              <div />
            )}
          </Group>
        )}

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

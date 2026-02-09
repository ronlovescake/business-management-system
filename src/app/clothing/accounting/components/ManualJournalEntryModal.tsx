import {
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Group,
  Stack,
  Button,
  Text,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';

import {
  collapseTaggableAccountsForOptions,
  isTaggableAccountParent,
  type TaggableAccountParent,
} from '@/lib/accounting/account-tagging';
import { UniversalModal } from '@/components/modals/UniversalModal';

import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { toDate, toISODate } from '@/utils/date';

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
  const {
    getFieldProps,
    getSelectProps,
    getAutosizeTextareaProps,
    selectDefaults,
    dateInputDefaults,
  } = usePolishedFieldStyles(opened);

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
        'Forwarder Payable',
        'Courier Payable',
        'Credit Card Payable',
        'Loan Payable',
        'Opening Equity',
        'Owner Contribution',
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

  const dateField = getFieldProps('date');
  const refField = getFieldProps('ref');
  const debitAccountSelect = getSelectProps('debitAccount');
  const creditAccountSelect = getSelectProps('creditAccount');
  const debitTagField = getFieldProps('debitAccountTag');
  const creditTagField = getFieldProps('creditAccountTag');
  const amountField = getFieldProps('amount');
  const descriptionField = getAutosizeTextareaProps('description');

  const tagHelperText = (parent: TaggableAccountParent) => {
    const label = parent === 'Loan Payable' ? 'Loan' : 'Vendor / AP';
    return `This will post to “${parent} – <${label}>” on the ledger.`;
  };

  return (
    <UniversalModal opened={opened} onClose={onClose} title={title} size="lg">
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        <Stack gap="md">
          <DateInput
            label="Date"
            valueFormat="MM/DD/YYYY"
            value={toDate(form.date)}
            onChange={(value) => onChange('date', toISODate(value))}
            minDate={new Date('2026-01-01')}
            {...dateField.handlers}
            styles={dateField.styles}
            {...dateInputDefaults}
          />

          <TextInput
            label="Reference"
            placeholder="e.g., PAYMENT • Jeh Aguisanda"
            value={form.ref}
            onChange={(event) => onChange('ref', event.currentTarget.value)}
            {...refField.handlers}
            styles={refField.styles}
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
              {...debitAccountSelect.handlers}
              styles={debitAccountSelect.styles}
              {...selectDefaults}
            />
            <Select
              label="Credit Account"
              placeholder="Select account"
              data={accountOptionData}
              value={form.creditAccount}
              searchable
              clearable
              onChange={(value) => onChange('creditAccount', value || '')}
              {...creditAccountSelect.handlers}
              styles={creditAccountSelect.styles}
              {...selectDefaults}
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
                    {...debitTagField.handlers}
                    styles={debitTagField.styles}
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
                    {...creditTagField.handlers}
                    styles={creditTagField.styles}
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
            {...amountField.handlers}
            styles={amountField.styles}
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
            {...descriptionField.handlers}
            styles={descriptionField.styles}
          />

          <Group justify="flex-end">
            <Button
              radius="md"
              variant="default"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button radius="md" onClick={onSubmit} loading={isSaving}>
              Save Entry
            </Button>
          </Group>
        </Stack>
      </div>
    </UniversalModal>
  );
}

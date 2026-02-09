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
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

export type OpeningBalanceEntryForm = {
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  debitAccount: string;
  creditAccount: string;
  debitAccountTag: string;
  creditAccountTag: string;
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
  const { getFieldProps, getSelectProps, getAutosizeTextareaProps } =
    usePolishedFieldStyles(opened);

  const entryDateLabel = form.date || 'the cutover date';
  const entryDateValue = form.date ? toDate(form.date) : null;

  const accountOptions = collapseTaggableAccountsForOptions(
    Array.from(
      new Set([
        ...accounts,
        'Cash',
        // Bank/GCash/E-Wallet are treated as cash equivalents.
        'Inventory',
        'Stock on Hand',
        'Inventory in Transit',
        'Opening Equity',
        'Accounts Receivable',
        'Accounts Payable',
        'Forwarder Payable',
        'Courier Payable',
        'Credit Card Payable',
        'Loan Payable',
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
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title={isEditing ? 'EDIT OPENING ENTRY' : 'ADD OPENING ENTRY'}
      size="lg"
    >
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        <Stack gap="md">
          <DateInput
            label="Date"
            valueFormat="MM/DD/YYYY"
            value={entryDateValue}
            onChange={(value) => onChange('date', toISODate(value))}
            minDate={entryDateValue || undefined}
            maxDate={entryDateValue || undefined}
            disabled
            {...dateField.handlers}
            styles={dateField.styles}
            {...COMMON_DATE_INPUT_PROPS}
          />

          <Text size="sm" c="dimmed">
            {isEditing
              ? `This updates a balanced opening entry on ${entryDateLabel} (one debit line, one credit line).`
              : `This creates two opening balance lines on ${entryDateLabel} (one debit, one credit).`}
          </Text>

          {isEditing && (!form.debitAccount || !form.creditAccount) && (
            <Text size="sm" c="orange.7">
              This looks like a single opening line. The editor expects a
              matching debit/credit pair with the same Date, Ref, Description,
              and Amount. Choose both accounts to make it a balanced opening
              entry.
            </Text>
          )}

          <TextInput
            label="Reference"
            placeholder="OPENING"
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
              limit={10}
              maxDropdownHeight={400}
              onChange={(value) => onChange('debitAccount', value || '')}
              {...debitAccountSelect.handlers}
              styles={debitAccountSelect.styles}
              withCheckIcon={false}
              comboboxProps={{ withinPortal: true, zIndex: 500 }}
            />
            <Select
              label="Credit Account"
              placeholder="Select account"
              data={accountOptionData}
              value={form.creditAccount}
              searchable
              clearable
              limit={10}
              maxDropdownHeight={400}
              onChange={(value) => onChange('creditAccount', value || '')}
              {...creditAccountSelect.handlers}
              styles={creditAccountSelect.styles}
              withCheckIcon={false}
              comboboxProps={{ withinPortal: true, zIndex: 500 }}
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
              {isEditing ? 'Update Opening Entry' : 'Save Opening Entry'}
            </Button>
          </Group>
        </Stack>
      </div>
    </UniversalModal>
  );
}

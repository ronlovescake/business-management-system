import {
  Alert,
  Anchor,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Group,
  Stack,
  Button,
  Text,
  List,
  Table,
  SegmentedControl,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { DateInput } from '@mantine/dates';

import {
  buildTaggedAccountName,
  collapseTaggableAccountsForOptions,
  isTaggableAccountParent,
  type TaggableAccountParent,
} from '@/lib/accounting/account-tagging';
import { UniversalModal } from '@/components/modals/UniversalModal';

import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { toDate, toISODate } from '@/utils/date';
import { validateManualEntryInput } from '@/lib/accounting/manual-entry';
import {
  CLOTHING_ENTRY_SCENARIOS,
  CLOTHING_MANUAL_ACCOUNT_DEFAULTS,
  getClothingEntryScenario,
  getClothingManualEntryAccounts,
  type ClothingEntryScenarioId,
} from '@/app/clothing/accounting/ledger/ledgerEntryGuidance';

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
  clothingGuided?: boolean;
  isEditing?: boolean;
  presetId?: ClothingEntryScenarioId | null;
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
  clothingGuided = false,
  isEditing = false,
  presetId = null,
}: ManualJournalEntryModalProps) {
  const [entryMode, setEntryMode] = useState<'guided' | 'manual'>(
    clothingGuided ? 'guided' : 'manual'
  );
  const [guidedStep, setGuidedStep] = useState(0);
  const [scenarioId, setScenarioId] = useState<ClothingEntryScenarioId | null>(
    null
  );
  const [guidedError, setGuidedError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }

    setEntryMode(clothingGuided && !isEditing ? 'guided' : 'manual');
    setGuidedStep(0);
    setScenarioId(presetId);
    setGuidedError(null);
  }, [opened, clothingGuided, isEditing, presetId]);

  const {
    getFieldProps,
    getSelectProps,
    getAutosizeTextareaProps,
    selectDefaults,
    dateInputDefaults,
  } = usePolishedFieldStyles(opened);

  const accountCandidates = Array.from(
    new Set([...accounts, ...CLOTHING_MANUAL_ACCOUNT_DEFAULTS])
  );
  const accountOptions = clothingGuided
    ? getClothingManualEntryAccounts(
        accountCandidates,
        isEditing ? [form.debitAccount, form.creditAccount] : []
      )
    : collapseTaggableAccountsForOptions(accountCandidates);

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

  const scenario = getClothingEntryScenario(scenarioId);
  const isGuided = clothingGuided && !isEditing && entryMode === 'guided';
  const finalDebitAccount = isTaggableAccountParent(form.debitAccount)
    ? buildTaggedAccountName(form.debitAccount, form.debitAccountTag)
    : form.debitAccount;
  const finalCreditAccount = isTaggableAccountParent(form.creditAccount)
    ? buildTaggedAccountName(form.creditAccount, form.creditAccountTag)
    : form.creditAccount;

  const selectScenario = (value: string | null) => {
    const nextScenario = getClothingEntryScenario(
      value as ClothingEntryScenarioId | null
    );

    if (nextScenario?.id === scenarioId) {
      return;
    }

    const hasEntryDetails = Boolean(
      form.ref.trim() ||
        form.amount > 0 ||
        form.description.trim() ||
        form.debitAccountTag.trim() ||
        form.creditAccountTag.trim()
    );
    if (
      hasEntryDetails &&
      !window.confirm(
        'Changing the entry type will clear the entered details. Continue?'
      )
    ) {
      return;
    }

    setScenarioId(nextScenario?.id ?? null);
    setGuidedError(null);
    onChange('debitAccount', nextScenario?.debitAccount ?? '');
    onChange('creditAccount', nextScenario?.creditAccount ?? '');
    onChange('debitAccountTag', '');
    onChange('creditAccountTag', '');
    onChange('ref', '');
    onChange('amount', 0);
    onChange('description', '');
  };

  const validateGuidedEntry = () => {
    if (!scenario?.debitAccount || !scenario.creditAccount) {
      setGuidedError('Choose a manual-entry type to continue.');
      return false;
    }

    if (!form.date) {
      setGuidedError('Enter the date the money was received or paid.');
      return false;
    }

    const validationError = validateManualEntryInput({
      ref: form.ref,
      debitAccount: finalDebitAccount,
      creditAccount: finalCreditAccount,
      amount: form.amount,
    });
    if (validationError) {
      setGuidedError(validationError.message);
      return false;
    }

    setGuidedError(null);
    return true;
  };

  const guidedTagFields = (
    <>
      {debitTaggableParent && (
        <TextInput
          label="Loan Tag"
          placeholder="Use the same loan name as its original entry"
          value={form.debitAccountTag}
          onChange={(event) =>
            onChange('debitAccountTag', event.currentTarget.value)
          }
          {...debitTagField.handlers}
          styles={debitTagField.styles}
        />
      )}
      {creditTaggableParent && (
        <TextInput
          label="Loan Tag"
          placeholder="e.g., Esquire Loan 1"
          value={form.creditAccountTag}
          onChange={(event) =>
            onChange('creditAccountTag', event.currentTarget.value)
          }
          {...creditTagField.handlers}
          styles={creditTagField.styles}
        />
      )}
    </>
  );

  return (
    <UniversalModal opened={opened} onClose={onClose} title={title} size="lg">
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        <Stack gap="md">
          {clothingGuided && !isEditing && (
            <SegmentedControl
              value={entryMode}
              onChange={(value) => {
                setEntryMode(value as 'guided' | 'manual');
                setGuidedError(null);
              }}
              data={[
                { label: 'Guided', value: 'guided' },
                { label: 'Manual', value: 'manual' },
              ]}
              fullWidth
            />
          )}

          {isGuided ? (
            <>
              <Text size="xs" c="dimmed">
                Step {guidedStep + 1} of 3
              </Text>

              {guidedStep === 0 && (
                <Stack gap="sm">
                  <Text fw={600}>What happened?</Text>
                  <Select
                    label="Choose a transaction"
                    placeholder="Select what you are recording"
                    data={[
                      ...CLOTHING_ENTRY_SCENARIOS.map((item) => ({
                        value: item.id,
                        label: item.title,
                      })),
                    ]}
                    value={scenarioId}
                    searchable
                    onChange={selectScenario}
                    {...selectDefaults}
                  />
                  {scenario && (
                    <Alert color="blue" title={scenario.when}>
                      <List size="sm" spacing="xs">
                        {scenario.steps.map((step) => (
                          <List.Item key={step}>{step}</List.Item>
                        ))}
                      </List>
                      {scenario.warning && (
                        <Text size="sm" mt="xs">
                          {scenario.warning}
                        </Text>
                      )}
                    </Alert>
                  )}
                </Stack>
              )}

              {guidedStep === 1 && scenario?.destination && (
                <Alert color="blue" title={scenario.when}>
                  <List type="ordered" size="sm" spacing="xs">
                    {scenario.steps.map((step) => (
                      <List.Item key={step}>{step}</List.Item>
                    ))}
                  </List>
                  <Text size="sm" mt="sm">
                    {scenario.warning}
                  </Text>
                  <Anchor href={scenario.destination.href} fw={600}>
                    {scenario.destination.label}
                  </Anchor>
                </Alert>
              )}

              {guidedStep === 1 && !scenario?.destination && (
                <Stack gap="md">
                  <Text fw={600}>Enter the transaction details</Text>
                  <DateInput
                    label="Date"
                    value={toDate(form.date)}
                    onChange={(value) => onChange('date', toISODate(value))}
                    minDate={new Date('2026-01-01')}
                    {...dateField.handlers}
                    styles={dateField.styles}
                    {...dateInputDefaults}
                  />
                  <TextInput
                    label="Reference"
                    placeholder={scenario?.referenceHint}
                    value={form.ref}
                    onChange={(event) =>
                      onChange('ref', event.currentTarget.value)
                    }
                    {...refField.handlers}
                    styles={refField.styles}
                  />
                  {guidedTagFields}
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
                </Stack>
              )}

              {guidedStep === 2 && scenario && (
                <Stack gap="sm">
                  <Text fw={600}>Review before saving</Text>
                  <Text size="sm">{scenario.review}</Text>
                  {scenario.warning && (
                    <Alert color="yellow">{scenario.warning}</Alert>
                  )}
                  <Table withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Account</Table.Th>
                        <Table.Th>Debit</Table.Th>
                        <Table.Th>Credit</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td>{finalDebitAccount}</Table.Td>
                        <Table.Td>
                          ₱{Number(form.amount).toLocaleString()}
                        </Table.Td>
                        <Table.Td>—</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>{finalCreditAccount}</Table.Td>
                        <Table.Td>—</Table.Td>
                        <Table.Td>
                          ₱{Number(form.amount).toLocaleString()}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                  <Text size="sm" c="dimmed">
                    Reference: {form.ref} · Date: {form.date}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Debits and credits are equal. Check this matches your
                    receipt or statement before saving.
                  </Text>
                </Stack>
              )}

              {guidedError && <Alert color="red">{guidedError}</Alert>}

              <Group justify="space-between">
                <Button
                  radius="sm"
                  variant="default"
                  onClick={
                    guidedStep === 0
                      ? onClose
                      : () => setGuidedStep(guidedStep - 1)
                  }
                  disabled={isSaving}
                >
                  {guidedStep === 0 ? 'Cancel' : 'Back'}
                </Button>
                {guidedStep === 0 && (
                  <Button
                    radius="sm"
                    onClick={() => {
                      if (!scenario) {
                        setGuidedError('Choose what happened to continue.');
                        return;
                      }
                      setGuidedError(null);
                      setGuidedStep(1);
                    }}
                  >
                    Continue
                  </Button>
                )}
                {guidedStep === 1 && scenario?.destination && (
                  <Button
                    component="a"
                    href={scenario.destination.href}
                    radius="sm"
                  >
                    {scenario.destination.label}
                  </Button>
                )}
                {guidedStep === 1 && !scenario?.destination && (
                  <Button
                    radius="sm"
                    onClick={() => {
                      if (validateGuidedEntry()) {
                        setGuidedStep(2);
                      }
                    }}
                  >
                    Review entry
                  </Button>
                )}
                {guidedStep === 2 && (
                  <Button onClick={onSubmit} loading={isSaving} radius="sm">
                    Save Entry
                  </Button>
                )}
              </Group>
            </>
          ) : (
            <>
              {clothingGuided && (
                <Alert color="blue">
                  Use this for a balanced two-account entry. Debit and credit
                  effects depend on the account type. Do not duplicate entries
                  already created by sales, refund, supplier, inventory, or
                  payroll workflows.
                </Alert>
              )}

              <DateInput
                label="Date"
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
                          onChange(
                            'creditAccountTag',
                            event.currentTarget.value
                          )
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
            </>
          )}
        </Stack>
      </div>
    </UniversalModal>
  );
}

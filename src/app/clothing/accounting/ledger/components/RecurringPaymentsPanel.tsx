'use client';

import React from 'react';
import {
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import {
  IconCalendar,
  IconCheck,
  IconPlus,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { ClothingRecurringPaymentService } from '@/services/ClothingRecurringPaymentService';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import { logger } from '@/lib/logger';
import {
  collapseTaggableAccountsForOptions,
  isTaggableAccountParent,
  normalizeAccountTag,
} from '@/lib/accounting/account-tagging';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import { formatCurrencyPHP } from '@/lib/accounting/formatters';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';

type TemplateKind = 'LOAN' | 'EXPENSE';

export type RecurringPaymentTemplateDTO = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  kind: TemplateKind;
  amount: number;
  frequency: 'MONTHLY';
  dayOfMonth: number;
  nextDueDate: string;
  endDate: string | null;
  debitAccount: string;
  debitTag: string | null;
  creditAccount: string;
  creditTag: string | null;
  notes: string | null;
  isActive: boolean;
};

export type RecurringPaymentDraftDTO = {
  id: string;
  createdAt: string;
  updatedAt: string;
  templateId: string;
  dueDate: string;
  amount: number;
  debitAccount: string;
  debitTag: string | null;
  creditAccount: string;
  creditTag: string | null;
  ref: string;
  description: string | null;
  status: 'DRAFT' | 'APPROVED' | 'SKIPPED';
  approvedAt: string | null;
  template: RecurringPaymentTemplateDTO;
};

export type RecurringPaymentService = {
  getTemplates: () => Promise<RecurringPaymentTemplateDTO[]>;
  createTemplate: (payload: {
    name: string;
    kind: TemplateKind;
    amount: number;
    frequency?: 'MONTHLY';
    dayOfMonth: number;
    nextDueDate: string;
    endDate?: string | null;
    debitAccount: string;
    debitTag?: string | null;
    creditAccount: string;
    creditTag?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }) => Promise<RecurringPaymentTemplateDTO>;
  updateTemplate: (
    id: string,
    payload: Partial<{
      name: string;
      kind: TemplateKind;
      amount: number;
      frequency: 'MONTHLY';
      dayOfMonth: number;
      nextDueDate: string;
      endDate: string | null;
      debitAccount: string;
      debitTag: string | null;
      creditAccount: string;
      creditTag: string | null;
      notes: string | null;
      isActive: boolean;
    }>
  ) => Promise<RecurringPaymentTemplateDTO>;
  deleteTemplateById: (id: string) => Promise<RecurringPaymentTemplateDTO>;
  generate: (payload?: { upToDate?: string }) => Promise<{
    created: number;
    skipped: number;
    upToDate: string;
  }>;
  getDrafts: (params?: {
    status?: 'DRAFT' | 'APPROVED' | 'SKIPPED';
    dueOnOrBefore?: string;
    dueFrom?: string;
    dueTo?: string;
  }) => Promise<RecurringPaymentDraftDTO[]>;
  approveDraft: (draftId: string) => Promise<{
    draftId: string;
    journalSourceId: string;
  }>;
  skipDraft: (draftId: string) => Promise<{ draftId: string }>;
};

type TemplateFormState = {
  name: string;
  kind: TemplateKind;
  amount: number;
  dayOfMonth: number;
  nextDueDate: string;
  endDate: string;
  debitAccount: string;
  debitTag: string;
  creditAccount: string;
  creditTag: string;
  notes: string;
  isActive: boolean;
};

const DEFAULT_FORM: TemplateFormState = {
  name: '',
  kind: 'LOAN',
  amount: 0,
  dayOfMonth: 1,
  nextDueDate: '2026-01-01',
  endDate: '',
  debitAccount: 'Loan Payable',
  debitTag: '',
  creditAccount: 'Cash',
  creditTag: '',
  notes: '',
  isActive: true,
};

const monthDiff = (from: Date, to: Date): number => {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
};

const paymentsLeft = (tpl: RecurringPaymentTemplateDTO): number | null => {
  if (!tpl.endDate) {
    return null;
  }

  const next = new Date(tpl.nextDueDate);
  const end = new Date(tpl.endDate);

  if (Number.isNaN(next.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (end.getTime() < next.getTime()) {
    return 0;
  }

  const fromMonth = new Date(next.getFullYear(), next.getMonth(), 1);
  const toMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  return monthDiff(fromMonth, toMonth) + 1;
};

const statusBadge = (status: RecurringPaymentDraftDTO['status']) => {
  switch (status) {
    case 'DRAFT':
      return <Badge color="blue">Draft</Badge>;
    case 'APPROVED':
      return <Badge color="green">Approved</Badge>;
    case 'SKIPPED':
      return <Badge color="gray">Skipped</Badge>;
    default:
      return <Badge color="gray">{status}</Badge>;
  }
};

export function RecurringPaymentsPanel(props: {
  accounts: string[];
  onLedgerUpdated: () => void;
  service?: RecurringPaymentService;
}) {
  const { accounts, onLedgerUpdated, service } = props;
  const apiService = service ?? ClothingRecurringPaymentService;

  const [templates, setTemplates] = React.useState<
    RecurringPaymentTemplateDTO[]
  >([]);
  const [drafts, setDrafts] = React.useState<RecurringPaymentDraftDTO[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState<string | null>(null);
  const [isSkipping, setIsSkipping] = React.useState<string | null>(null);

  const [dueOnOrBefore, setDueOnOrBefore] = React.useState<string>(
    formatDateForInput(new Date())
  );

  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<TemplateFormState>(DEFAULT_FORM);
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);

  const { getFieldProps, getSelectProps } =
    usePolishedFieldStyles(isCreateModalOpen);

  const accountOptions = React.useMemo(() => {
    const normalized = accounts.map((account) =>
      normalizeAccountForReporting(account)
    );
    return collapseTaggableAccountsForOptions(normalized);
  }, [accounts]);

  const nameField = getFieldProps('name');
  const kindSelect = getSelectProps('kind');
  const amountField = getFieldProps('amount');
  const dayOfMonthField = getFieldProps('dayOfMonth');
  const nextDueDateField = getFieldProps('nextDueDate');
  const endDateField = getFieldProps('endDate');
  const debitAccountSelect = getSelectProps('debitAccount');
  const debitTagField = getFieldProps('debitTag');
  const creditAccountSelect = getSelectProps('creditAccount');
  const creditTagField = getFieldProps('creditTag');
  const notesField = getFieldProps('notes');

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [tpls, drs] = await Promise.all([
        apiService.getTemplates(),
        apiService.getDrafts({
          status: 'DRAFT',
          dueOnOrBefore,
        }),
      ]);

      setTemplates(tpls);
      setDrafts(drs);
    } catch (error) {
      logger.error('Failed to load recurring payment data', { error });
      showNotification({
        title: 'Recurring payments',
        message: error instanceof Error ? error.message : 'Failed to load data',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, [apiService, dueOnOrBefore]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await apiService.generate({
        upToDate: dueOnOrBefore,
      });

      showNotification({
        title: 'Recurring payments',
        message: `Generated ${result.created} drafts (${result.skipped} skipped)`,
        color: 'green',
      });

      await refresh();
    } catch (error) {
      logger.error('Failed to generate drafts', { error });
      showNotification({
        title: 'Recurring payments',
        message:
          error instanceof Error ? error.message : 'Failed to generate drafts',
        color: 'red',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async (draftId: string) => {
    setIsApproving(draftId);
    try {
      await apiService.approveDraft(draftId);
      showNotification({
        title: 'Recurring payments',
        message: 'Draft approved and posted to ledger',
        color: 'green',
      });
      onLedgerUpdated();
      await refresh();
    } catch (error) {
      logger.error('Failed to approve draft', { error });
      showNotification({
        title: 'Recurring payments',
        message: error instanceof Error ? error.message : 'Failed to approve',
        color: 'red',
      });
    } finally {
      setIsApproving(null);
    }
  };

  const handleSkip = async (draftId: string) => {
    setIsSkipping(draftId);
    try {
      await apiService.skipDraft(draftId);
      showNotification({
        title: 'Recurring payments',
        message: 'Draft skipped',
        color: 'gray',
      });
      await refresh();
    } catch (error) {
      logger.error('Failed to skip draft', { error });
      showNotification({
        title: 'Recurring payments',
        message: error instanceof Error ? error.message : 'Failed to skip',
        color: 'red',
      });
    } finally {
      setIsSkipping(null);
    }
  };

  const resetForm = () => setForm(DEFAULT_FORM);

  const handleCreateTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      const endDate = form.endDate.trim() ? form.endDate.trim() : null;

      const debitTag =
        isTaggableAccountParent(form.debitAccount) && form.debitTag.trim()
          ? normalizeAccountTag(form.debitTag)
          : null;

      const creditTag =
        isTaggableAccountParent(form.creditAccount) && form.creditTag.trim()
          ? normalizeAccountTag(form.creditTag)
          : null;

      await apiService.createTemplate({
        name: form.name.trim(),
        kind: form.kind,
        amount: form.amount,
        dayOfMonth: form.dayOfMonth,
        nextDueDate: form.nextDueDate.trim(),
        endDate,
        debitAccount: form.debitAccount,
        debitTag,
        creditAccount: form.creditAccount,
        creditTag,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      });

      showNotification({
        title: 'Recurring payments',
        message: 'Template created',
        color: 'green',
      });

      setIsCreateModalOpen(false);
      resetForm();
      await refresh();
    } catch (error) {
      logger.error('Failed to create template', { error });
      showNotification({
        title: 'Recurring payments',
        message:
          error instanceof Error ? error.message : 'Failed to create template',
        color: 'red',
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const templateRows = templates.map((tpl) => {
    const remaining = paymentsLeft(tpl);

    return (
      <Table.Tr key={tpl.id}>
        <Table.Td>{tpl.name}</Table.Td>
        <Table.Td>
          <Badge color={tpl.kind === 'LOAN' ? 'violet' : 'teal'}>
            {tpl.kind}
          </Badge>
        </Table.Td>
        <Table.Td>{formatCurrencyPHP(tpl.amount)}</Table.Td>
        <Table.Td>{new Date(tpl.nextDueDate).toLocaleDateString()}</Table.Td>
        <Table.Td>
          {tpl.endDate ? new Date(tpl.endDate).toLocaleDateString() : '—'}
        </Table.Td>
        <Table.Td>{remaining === null ? '—' : remaining}</Table.Td>
        <Table.Td>
          <Switch
            checked={tpl.isActive}
            onChange={async (e) => {
              try {
                await apiService.updateTemplate(tpl.id, {
                  isActive: e.currentTarget.checked,
                });
                await refresh();
              } catch (error) {
                showNotification({
                  title: 'Recurring payments',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Failed to update template',
                  color: 'red',
                });
              }
            }}
            label={tpl.isActive ? 'Active' : 'Inactive'}
          />
        </Table.Td>
      </Table.Tr>
    );
  });

  const draftRows = drafts.map((draft) => (
    <Table.Tr key={draft.id}>
      <Table.Td>{new Date(draft.dueDate).toLocaleDateString()}</Table.Td>
      <Table.Td>{draft.template.name}</Table.Td>
      <Table.Td>{formatCurrencyPHP(draft.amount)}</Table.Td>
      <Table.Td>{draft.debitAccount}</Table.Td>
      <Table.Td>{draft.creditAccount}</Table.Td>
      <Table.Td>{statusBadge(draft.status)}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs"
            color="green"
            leftSection={<IconCheck size={14} />}
            loading={isApproving === draft.id}
            onClick={() => handleApprove(draft.id)}
          >
            Approve
          </Button>
          <Button
            size="xs"
            color="gray"
            variant="light"
            leftSection={<IconX size={14} />}
            loading={isSkipping === draft.id}
            onClick={() => handleSkip(draft.id)}
          >
            Skip
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <DateInput
          label="Show drafts due on or before"
          leftSection={<IconCalendar size={16} />}
          value={parseDateValue(dueOnOrBefore)}
          onChange={(value) => {
            const next = value ? formatDateForInput(value) : '';
            setDueOnOrBefore(next || formatDateForInput(new Date()));
          }}
          {...COMMON_DATE_INPUT_PROPS}
        />

        <Group gap="sm" wrap="wrap">
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            loading={isGenerating}
            onClick={handleGenerate}
          >
            Generate drafts
          </Button>

          <Button
            leftSection={<IconPlus size={16} />}
            color="green"
            onClick={() => setIsCreateModalOpen(true)}
          >
            New template
          </Button>
        </Group>
      </Group>

      <Divider label="Due drafts" />

      <Table withTableBorder withColumnBorders striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Due</Table.Th>
            <Table.Th>Template</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Debit</Table.Th>
            <Table.Th>Credit</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {draftRows.length ? (
            draftRows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" ta="center">
                  {isLoading
                    ? 'Loading drafts…'
                    : 'No drafts due for approval.'}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Divider label="Templates" />

      <Table withTableBorder withColumnBorders striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Kind</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Next due</Table.Th>
            <Table.Th>End</Table.Th>
            <Table.Th>Payments left</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {templateRows.length ? (
            templateRows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" ta="center">
                  {isLoading ? 'Loading templates…' : 'No templates yet.'}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <PolishedModal
        opened={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetForm();
        }}
        title="New recurring payment template"
        size="lg"
      >
        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <Stack gap="sm">
            <TextInput
              label="Name"
              placeholder="e.g., GCASH Loan 1"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              {...nameField.handlers}
              styles={nameField.styles}
            />

            <Group grow align="flex-end">
              <Select
                label="Kind"
                data={[
                  { value: 'LOAN', label: 'Loan (principal only)' },
                  { value: 'EXPENSE', label: 'Expense / Subscription' },
                ]}
                value={form.kind}
                onChange={(value) =>
                  setForm((p) => ({
                    ...p,
                    kind: (value as TemplateKind) ?? 'LOAN',
                  }))
                }
                limit={10}
                maxDropdownHeight={400}
                {...kindSelect.handlers}
                styles={kindSelect.styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
              <NumberInput
                label="Amount"
                min={0}
                value={form.amount}
                onChange={(value) =>
                  setForm((p) => ({
                    ...p,
                    amount: typeof value === 'number' ? value : 0,
                  }))
                }
                {...amountField.handlers}
                styles={amountField.styles}
              />
            </Group>

            <Group grow align="flex-end">
              <NumberInput
                label="Day of month"
                description="Used to compute the next due date after generation"
                min={1}
                max={31}
                value={form.dayOfMonth}
                onChange={(value) =>
                  setForm((p) => ({
                    ...p,
                    dayOfMonth: typeof value === 'number' ? value : 1,
                  }))
                }
                {...dayOfMonthField.handlers}
                styles={dayOfMonthField.styles}
              />

              <DateInput
                label="Next due date"
                value={parseDateValue(form.nextDueDate)}
                onChange={(value) =>
                  setForm((p) => ({
                    ...p,
                    nextDueDate: value
                      ? formatDateForInput(value)
                      : DEFAULT_FORM.nextDueDate,
                  }))
                }
                {...nextDueDateField.handlers}
                styles={nextDueDateField.styles}
                {...COMMON_DATE_INPUT_PROPS}
              />

              <DateInput
                label="End date (optional)"
                value={parseDateValue(form.endDate)}
                onChange={(value) =>
                  setForm((p) => ({
                    ...p,
                    endDate: value ? formatDateForInput(value) : '',
                  }))
                }
                clearable
                {...endDateField.handlers}
                styles={endDateField.styles}
                {...COMMON_DATE_INPUT_PROPS}
              />
            </Group>

            <Divider />

            <Group grow align="flex-end">
              <Select
                label="Debit account"
                data={accountOptions}
                searchable
                value={form.debitAccount}
                onChange={(value) =>
                  setForm((p) => ({ ...p, debitAccount: value ?? '' }))
                }
                limit={10}
                maxDropdownHeight={400}
                {...debitAccountSelect.handlers}
                styles={debitAccountSelect.styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
              <TextInput
                label="Debit tag (optional)"
                disabled={!isTaggableAccountParent(form.debitAccount)}
                value={form.debitTag}
                onChange={(e) =>
                  setForm((p) => ({ ...p, debitTag: e.target.value }))
                }
                {...debitTagField.handlers}
                styles={debitTagField.styles}
              />
            </Group>

            <Group grow align="flex-end">
              <Select
                label="Credit account"
                data={accountOptions}
                searchable
                value={form.creditAccount}
                onChange={(value) =>
                  setForm((p) => ({ ...p, creditAccount: value ?? '' }))
                }
                limit={10}
                maxDropdownHeight={400}
                {...creditAccountSelect.handlers}
                styles={creditAccountSelect.styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
              <TextInput
                label="Credit tag (optional)"
                disabled={!isTaggableAccountParent(form.creditAccount)}
                value={form.creditTag}
                onChange={(e) =>
                  setForm((p) => ({ ...p, creditTag: e.target.value }))
                }
                {...creditTagField.handlers}
                styles={creditTagField.styles}
              />
            </Group>

            <TextInput
              label="Notes (optional)"
              placeholder="Shown as the ledger line description"
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              {...notesField.handlers}
              styles={notesField.styles}
            />

            <Switch
              checked={form.isActive}
              onChange={(e) =>
                setForm((p) => ({ ...p, isActive: e.currentTarget.checked }))
              }
              label="Active"
            />

            <Group justify="flex-end" mt="sm">
              <Button
                radius="md"
                variant="default"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                radius="md"
                loading={isSavingTemplate}
                onClick={handleCreateTemplate}
                styles={polishedPrimaryButtonStyles}
              >
                Create
              </Button>
            </Group>
          </Stack>
        </div>
      </PolishedModal>
    </Stack>
  );
}

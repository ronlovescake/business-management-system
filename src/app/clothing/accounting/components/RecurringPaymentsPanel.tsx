'use client';

import React from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { IconRepeat } from '@tabler/icons-react';
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
import { buildLedgerAccounts } from '@/app/clothing/accounting/ledger/hooks/ledgerDerivedData';
import { UniversalModal } from '@/components/modals/UniversalModal';
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

type TemplatePayload = {
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
};

export type RecurringPaymentService = {
  getTemplates: () => Promise<RecurringPaymentTemplateDTO[]>;
  createTemplate: (
    payload: TemplatePayload
  ) => Promise<RecurringPaymentTemplateDTO>;
  updateTemplate: (
    id: string,
    payload: Partial<TemplatePayload>
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

export type RecurringGenerateResult = {
  created: number;
  skipped: number;
  upToDate: string;
};

type TemplateFormState = {
  name: string;
  kind: TemplateKind;
  amount: number | '';
  dayOfMonth: number | '';
  nextDueDate: string;
  endDate: string;
  debitAccount: string;
  debitTag: string;
  creditAccount: string;
  creditTag: string;
  notes: string;
  isActive: boolean;
};

const MAX_TEMPLATE_NAME_LENGTH = 255;

const KIND_OPTIONS = [
  { value: 'EXPENSE', label: 'Expense / Subscription' },
  { value: 'LOAN', label: 'Loan (principal only)' },
];

const HEADER_CELL_STYLE: React.CSSProperties = {
  padding: '16px 12px',
  color: '#495057',
  backgroundColor: '#f1f3f5',
  textAlign: 'center',
};

const buildDefaultForm = (): TemplateFormState => ({
  name: '',
  kind: 'EXPENSE',
  amount: '',
  dayOfMonth: new Date().getDate(),
  nextDueDate: formatDateForInput(new Date()),
  endDate: '',
  debitAccount: 'Monthly Dues Expense',
  debitTag: '',
  creditAccount: 'Cash',
  creditTag: '',
  notes: '',
  isActive: true,
});

const formatIsoDate = (value: string | null | undefined) => {
  const parsed = parseDateValue(value ?? null);
  return parsed ? formatDateForInput(parsed) : '';
};

const formatDisplayDate = (value: string | null | undefined) =>
  formatIsoDate(value) || '—';

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
  return (
    (end.getUTCFullYear() - next.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - next.getUTCMonth()) +
    1
  );
};

const resolveTaggedAccountLabel = (account: string, tag: string | null) => {
  const normalizedTag = (tag ?? '').trim();
  return normalizedTag ? `${account} – ${normalizedTag}` : account;
};

const buildTemplateRefPreview = (name: string) =>
  `RECURRING:${name}`.slice(0, 120);

const compareTemplates = (
  left: RecurringPaymentTemplateDTO,
  right: RecurringPaymentTemplateDTO
) => {
  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
  }
  const byDue = left.nextDueDate.localeCompare(right.nextDueDate);
  return byDue !== 0 ? byDue : left.name.localeCompare(right.name);
};

const formFromTemplate = (
  tpl: RecurringPaymentTemplateDTO
): TemplateFormState => ({
  name: tpl.name,
  kind: tpl.kind,
  amount: tpl.amount,
  dayOfMonth: tpl.dayOfMonth,
  nextDueDate: formatIsoDate(tpl.nextDueDate),
  endDate: formatIsoDate(tpl.endDate),
  debitAccount: tpl.debitAccount,
  debitTag: tpl.debitTag ?? '',
  creditAccount: tpl.creditAccount,
  creditTag: tpl.creditTag ?? '',
  notes: tpl.notes ?? '',
  isActive: tpl.isActive,
});

const buildPayload = (form: TemplateFormState): TemplatePayload => ({
  name: form.name.trim(),
  kind: form.kind,
  amount: Number(form.amount),
  dayOfMonth: Number(form.dayOfMonth),
  nextDueDate: form.nextDueDate,
  endDate: form.endDate || null,
  debitAccount: form.debitAccount,
  debitTag:
    isTaggableAccountParent(form.debitAccount) && form.debitTag.trim()
      ? normalizeAccountTag(form.debitTag)
      : null,
  creditAccount: form.creditAccount,
  creditTag:
    isTaggableAccountParent(form.creditAccount) && form.creditTag.trim()
      ? normalizeAccountTag(form.creditTag)
      : null,
  notes: form.notes.trim() || null,
  isActive: form.isActive,
});

// Unchanged dates are omitted so older templates can still be renamed after the cutover moves.
const buildChangedFields = (
  tpl: RecurringPaymentTemplateDTO,
  payload: TemplatePayload
): Partial<TemplatePayload> => {
  const original = buildPayload(formFromTemplate(tpl));
  const changes: Partial<TemplatePayload> = {};
  (Object.keys(payload) as (keyof TemplatePayload)[]).forEach((key) => {
    if (payload[key] !== original[key]) {
      Object.assign(changes, { [key]: payload[key] });
    }
  });
  return changes;
};

const getValidationError = (form: TemplateFormState): string | null => {
  const name = form.name.trim();
  if (!name) {
    return 'Name is required.';
  }
  if (name.length > MAX_TEMPLATE_NAME_LENGTH) {
    return `Name must be ${MAX_TEMPLATE_NAME_LENGTH} characters or fewer.`;
  }
  if (form.amount === '' || Number(form.amount) <= 0) {
    return 'Amount must be greater than zero.';
  }
  if (
    form.dayOfMonth === '' ||
    form.dayOfMonth < 1 ||
    form.dayOfMonth > 31 ||
    !Number.isInteger(form.dayOfMonth)
  ) {
    return 'Day of month must be between 1 and 31.';
  }
  if (!form.nextDueDate) {
    return 'Next due date is required.';
  }
  if (form.endDate && form.endDate < form.nextDueDate) {
    return 'End date must be on or after the next due date.';
  }
  if (!form.debitAccount || !form.creditAccount) {
    return 'Debit and credit accounts are required.';
  }
  return null;
};

export function RecurringPaymentsPanel(props: {
  searchQuery: string;
  opened: boolean;
  setOpened: (opened: boolean) => void;
  accounts?: string[];
  service?: RecurringPaymentService;
  onLedgerUpdated?: () => void;
  refreshToken?: number;
  lastGenerateResult?: RecurringGenerateResult | null;
  showDrafts?: boolean;
}) {
  const {
    searchQuery,
    opened,
    setOpened,
    accounts = [],
    service,
    onLedgerUpdated,
    refreshToken = 0,
    lastGenerateResult,
    showDrafts = true,
  } = props;
  const apiService = service ?? ClothingRecurringPaymentService;

  const [templates, setTemplates] = React.useState<
    RecurringPaymentTemplateDTO[]
  >([]);
  const [drafts, setDrafts] = React.useState<RecurringPaymentDraftDTO[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [busyDraftId, setBusyDraftId] = React.useState<string | null>(null);
  const [busyTemplateId, setBusyTemplateId] = React.useState<string | null>(
    null
  );

  const [editingTemplate, setEditingTemplate] =
    React.useState<RecurringPaymentTemplateDTO | null>(null);
  const [form, setForm] = React.useState<TemplateFormState>(buildDefaultForm);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const isEditing = editingTemplate !== null;

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [tpls, drs] = await Promise.all([
        apiService.getTemplates(),
        apiService.getDrafts({
          status: 'DRAFT',
          dueOnOrBefore: formatDateForInput(new Date()),
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
  }, [apiService]);

  React.useEffect(() => {
    void refresh();
  }, [refresh, refreshToken]);

  React.useEffect(() => {
    if (!opened) {
      setEditingTemplate(null);
      setForm(buildDefaultForm());
      setSaveError(null);
    }
  }, [opened]);

  const accountOptions = React.useMemo(() => {
    const names = buildLedgerAccounts([
      ...accounts.map((account) => ({ account })),
      ...templates.flatMap((tpl) => [
        { account: tpl.debitAccount },
        { account: tpl.creditAccount },
      ]),
      { account: 'Monthly Dues Expense' },
    ]).map((account) => normalizeAccountForReporting(account));
    return collapseTaggableAccountsForOptions(names);
  }, [accounts, templates]);

  const { getFieldProps, getSelectProps, getTextareaProps } =
    usePolishedFieldStyles(opened);
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
  const notesField = getTextareaProps('notes');

  const notifyError = (error: unknown, fallback: string) => {
    showNotification({
      title: 'Recurring payments',
      message: error instanceof Error ? error.message : fallback,
      color: 'red',
    });
  };

  const startEditing = (tpl: RecurringPaymentTemplateDTO) => {
    setEditingTemplate(tpl);
    setForm(formFromTemplate(tpl));
    setSaveError(null);
    setOpened(true);
  };

  const handleSave = async () => {
    const validationError = getValidationError(form);
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    const payload = buildPayload(form);
    setIsSaving(true);
    setSaveError(null);
    try {
      if (editingTemplate) {
        const changes = buildChangedFields(editingTemplate, payload);
        if (Object.keys(changes).length) {
          await apiService.updateTemplate(editingTemplate.id, changes);
        }
      } else {
        await apiService.createTemplate(payload);
      }
      showNotification({
        title: 'Recurring payments',
        message: editingTemplate
          ? 'Recurring payment updated'
          : 'Recurring payment created',
        color: 'green',
      });
      setOpened(false);
      await refresh();
    } catch (error) {
      logger.error('Failed to save recurring payment', { error });
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Failed to save recurring payment'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (tpl: RecurringPaymentTemplateDTO) => {
    setBusyTemplateId(tpl.id);
    try {
      await apiService.updateTemplate(tpl.id, { isActive: !tpl.isActive });
      await refresh();
    } catch (error) {
      notifyError(error, 'Failed to update recurring payment');
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleApprove = async (draftId: string) => {
    setBusyDraftId(draftId);
    try {
      await apiService.approveDraft(draftId);
      showNotification({
        title: 'Recurring payments',
        message: 'Draft approved and posted to ledger',
        color: 'green',
      });
      onLedgerUpdated?.();
      await refresh();
    } catch (error) {
      logger.error('Failed to approve draft', { error });
      notifyError(error, 'Failed to approve');
    } finally {
      setBusyDraftId(null);
    }
  };

  const handleSkip = async (draftId: string) => {
    setBusyDraftId(draftId);
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
      notifyError(error, 'Failed to skip');
    } finally {
      setBusyDraftId(null);
    }
  };

  const filteredTemplates = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates
      .filter((tpl) => {
        if (!query) {
          return true;
        }
        return [
          tpl.name,
          tpl.kind,
          tpl.debitAccount,
          tpl.creditAccount,
          tpl.notes ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort(compareTemplates);
  }, [templates, searchQuery]);

  const draftRows = drafts.map((draft) => (
    <Table.Tr key={draft.id}>
      <Table.Td style={{ textAlign: 'center', color: '#495057' }}>
        {formatDisplayDate(draft.dueDate)}
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500} c="#495057">
          {draft.template.name}
        </Text>
      </Table.Td>
      <Table.Td style={{ textAlign: 'right' }}>
        <Text fw={600} c="#495057">
          {formatCurrencyPHP(draft.amount)}
        </Text>
      </Table.Td>
      <Table.Td style={{ textAlign: 'center' }}>
        <Text size="sm" c="#495057">
          {resolveTaggedAccountLabel(draft.debitAccount, draft.debitTag)} →{' '}
          {resolveTaggedAccountLabel(draft.creditAccount, draft.creditTag)}
        </Text>
      </Table.Td>
      <Table.Td style={{ textAlign: 'center' }}>
        <Group gap="xs" justify="center" wrap="nowrap">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            loading={busyDraftId === draft.id}
            onClick={() => void handleSkip(draft.id)}
          >
            Skip
          </Button>
          <Button
            size="xs"
            variant="light"
            color="green"
            loading={busyDraftId === draft.id}
            onClick={() => void handleApprove(draft.id)}
          >
            Approve
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  const templateRows = filteredTemplates.map((tpl) => {
    const remaining = paymentsLeft(tpl);
    const description = tpl.notes?.trim() ?? '';
    return (
      <Table.Tr
        key={tpl.id}
        onDoubleClick={() => startEditing(tpl)}
        style={{ cursor: 'pointer' }}
        title="Double-click to edit"
      >
        <Table.Td>
          <Tooltip
            label={description}
            disabled={!description}
            multiline
            w={420}
            withArrow
            openDelay={300}
          >
            <Text size="sm" fw={500} c="#495057">
              {tpl.name}
            </Text>
          </Tooltip>
        </Table.Td>
        <Table.Td style={{ textAlign: 'right' }}>
          <Text fw={600} c="#495057">
            {formatCurrencyPHP(tpl.amount)}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Badge
            color={tpl.kind === 'LOAN' ? 'violet' : 'teal'}
            variant="light"
          >
            {tpl.kind === 'LOAN' ? 'Loan' : 'Expense'}
          </Badge>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm" c="#495057">
            {resolveTaggedAccountLabel(tpl.debitAccount, tpl.debitTag)} →{' '}
            {resolveTaggedAccountLabel(tpl.creditAccount, tpl.creditTag)}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center', color: '#495057' }}>
          {formatDisplayDate(tpl.nextDueDate)}
          <Text size="xs" c="dimmed">
            Day {tpl.dayOfMonth} monthly
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center', color: '#495057' }}>
          {remaining ?? '—'}
          {tpl.endDate ? (
            <Text size="xs" c="dimmed">
              until {formatDisplayDate(tpl.endDate)}
            </Text>
          ) : null}
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Badge color={tpl.isActive ? 'green' : 'gray'} variant="light">
            {tpl.isActive ? 'Active' : 'Paused'}
          </Badge>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Group gap="xs" justify="center" wrap="nowrap">
            <Button
              size="xs"
              variant="subtle"
              color={tpl.isActive ? 'orange' : 'green'}
              loading={busyTemplateId === tpl.id}
              onClick={(event) => {
                event.stopPropagation();
                void handleToggleActive(tpl);
              }}
            >
              {tpl.isActive ? 'Pause' : 'Resume'}
            </Button>
            <Button
              size="xs"
              variant="light"
              onClick={(event) => {
                event.stopPropagation();
                startEditing(tpl);
              }}
            >
              Edit
            </Button>
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  const modalTitle = (
    <Group gap="sm" align="center">
      <IconRepeat size={26} color="#65ab58" />
      <Stack gap={2}>
        <Text fw={700} fz="lg" c="#101828">
          {isEditing ? 'Edit Recurring Payment' : 'Add Recurring Payment'}
        </Text>
        <Text fz="sm" c="#667085">
          {isEditing
            ? 'Update the details for this recurring payment'
            : 'Fill in the details to add a recurring payment'}
        </Text>
      </Stack>
    </Group>
  );

  return (
    <Stack gap="md">
      {lastGenerateResult ? (
        <Text c="dimmed" size="sm">
          Generated {lastGenerateResult.created} drafts (skipped{' '}
          {lastGenerateResult.skipped}) due on or before{' '}
          {formatDisplayDate(lastGenerateResult.upToDate)}
          {showDrafts ? '.' : '. Review them in the Expense List.'}
        </Text>
      ) : null}

      {showDrafts && drafts.length ? (
        <Card withBorder padding={0} style={{ overflow: 'hidden' }}>
          <Group justify="space-between" px="md" py="sm">
            <Text fw={600} c="#495057">
              Drafts awaiting approval ({drafts.length})
            </Text>
            <Text size="sm" c="dimmed">
              Approving posts the payment to the ledger.
            </Text>
          </Group>
          <Table highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 160 }}>
                  DUE
                </Table.Th>
                <Table.Th style={HEADER_CELL_STYLE}>NAME</Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 180 }}>
                  AMOUNT
                </Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 300 }}>
                  ACCOUNTS
                </Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 200 }}>
                  ACTIONS
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{draftRows}</Table.Tbody>
          </Table>
        </Card>
      ) : null}

      <Card
        withBorder
        padding={0}
        style={{ overflow: 'hidden', height: '73vh' }}
      >
        <Box style={{ height: '100%', overflowY: 'auto' }}>
          <Table highlightOnHover withTableBorder>
            <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
              <Table.Tr>
                <Table.Th style={HEADER_CELL_STYLE}>NAME</Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 180 }}>
                  AMOUNT
                </Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 130 }}>
                  KIND
                </Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 300 }}>
                  ACCOUNTS
                </Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 160 }}>
                  NEXT DUE
                </Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 160 }}>
                  PAYMENTS LEFT
                </Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 120 }}>
                  STATUS
                </Table.Th>
                <Table.Th style={{ ...HEADER_CELL_STYLE, width: 200 }}>
                  ACTIONS
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading && templates.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      Loading recurring payments…
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : filteredTemplates.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      {templates.length === 0
                        ? 'No recurring payments yet.'
                        : 'No recurring payments found'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                templateRows
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Card>

      <UniversalModal
        opened={opened}
        onClose={() => setOpened(false)}
        title={modalTitle}
        size="lg"
      >
        <Stack gap="lg">
          <Group grow align="flex-start">
            <DateInput
              label="Next Due Date"
              required
              value={parseDateValue(form.nextDueDate)}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  nextDueDate: value ? formatDateForInput(value) : '',
                }))
              }
              {...nextDueDateField.handlers}
              styles={nextDueDateField.styles}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <Select
              label="Kind"
              data={KIND_OPTIONS}
              value={form.kind}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  kind: (value as TemplateKind) ?? 'EXPENSE',
                }))
              }
              required
              allowDeselect={false}
              maxDropdownHeight={400}
              {...kindSelect.handlers}
              styles={kindSelect.styles}
              withCheckIcon={false}
              comboboxProps={{ withinPortal: true, zIndex: 500 }}
            />
          </Group>

          <Group grow align="flex-start">
            <NumberInput
              label="Monthly Amount"
              prefix="₱ "
              decimalScale={2}
              thousandSeparator=","
              min={0}
              required
              value={form.amount}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  amount: typeof value === 'number' ? value : '',
                }))
              }
              {...amountField.handlers}
              styles={amountField.styles}
            />
            <NumberInput
              label="Day of Month"
              description="Due day used for later months"
              min={1}
              max={31}
              allowDecimal={false}
              required
              value={form.dayOfMonth}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  dayOfMonth: typeof value === 'number' ? value : '',
                }))
              }
              {...dayOfMonthField.handlers}
              styles={dayOfMonthField.styles}
            />
          </Group>

          <TextInput
            label="Name"
            placeholder="e.g., BPI Credit Card, GGives, Spotify"
            required
            maxLength={MAX_TEMPLATE_NAME_LENGTH}
            value={form.name}
            onChange={(event) => {
              const name = event.currentTarget.value;
              setForm((previous) => ({ ...previous, name }));
            }}
            description={`Journal reference: ${buildTemplateRefPreview(
              form.name.trim()
            )}`}
            {...nameField.handlers}
            styles={nameField.styles}
          />

          <Group grow align="flex-start">
            <Select
              label="Debit Account"
              data={accountOptions}
              searchable
              required
              value={form.debitAccount}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  debitAccount: value ?? '',
                }))
              }
              maxDropdownHeight={400}
              {...debitAccountSelect.handlers}
              styles={debitAccountSelect.styles}
              withCheckIcon={false}
              comboboxProps={{ withinPortal: true, zIndex: 500 }}
            />
            <TextInput
              label="Debit Tag (Optional)"
              disabled={!isTaggableAccountParent(form.debitAccount)}
              value={form.debitTag}
              onChange={(event) => {
                const debitTag = event.currentTarget.value;
                setForm((previous) => ({ ...previous, debitTag }));
              }}
              {...debitTagField.handlers}
              styles={debitTagField.styles}
            />
          </Group>

          <Group grow align="flex-start">
            <Select
              label="Credit Account"
              data={accountOptions}
              searchable
              required
              value={form.creditAccount}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  creditAccount: value ?? '',
                }))
              }
              maxDropdownHeight={400}
              {...creditAccountSelect.handlers}
              styles={creditAccountSelect.styles}
              withCheckIcon={false}
              comboboxProps={{ withinPortal: true, zIndex: 500 }}
            />
            <TextInput
              label="Credit Tag (Optional)"
              disabled={!isTaggableAccountParent(form.creditAccount)}
              value={form.creditTag}
              onChange={(event) => {
                const creditTag = event.currentTarget.value;
                setForm((previous) => ({ ...previous, creditTag }));
              }}
              {...creditTagField.handlers}
              styles={creditTagField.styles}
            />
          </Group>

          <Group grow align="flex-start">
            <DateInput
              label="End Date (Optional)"
              description="Leave blank for subscriptions with no end date"
              clearable
              value={parseDateValue(form.endDate)}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  endDate: value ? formatDateForInput(value) : '',
                }))
              }
              {...endDateField.handlers}
              styles={endDateField.styles}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <Stack gap={10} style={{ flex: 1 }}>
              <Text size="sm" fw={500} c="#101828">
                Options
              </Text>
              <Switch
                label="Active"
                description="Paused payments do not generate new drafts"
                checked={form.isActive}
                onChange={(event) => {
                  const isActive = event.currentTarget.checked;
                  setForm((previous) => ({ ...previous, isActive }));
                }}
              />
            </Stack>
          </Group>

          <Textarea
            label="Description (Optional)"
            placeholder="Shown on generated drafts and journal lines"
            minRows={3}
            value={form.notes}
            onChange={(event) => {
              const notes = event.currentTarget.value;
              setForm((previous) => ({ ...previous, notes }));
            }}
            {...notesField.handlers}
            styles={notesField.styles}
          />

          {saveError ? (
            <Text c="red" size="sm">
              {saveError}
            </Text>
          ) : null}

          <Group justify="flex-end" gap="sm" mt="sm">
            <Button
              radius="md"
              variant="default"
              onClick={() => setOpened(false)}
            >
              Cancel
            </Button>
            <Button
              radius="md"
              loading={isSaving}
              onClick={() => void handleSave()}
            >
              {isEditing ? 'Update' : 'Save'}
            </Button>
          </Group>
        </Stack>
      </UniversalModal>
    </Stack>
  );
}

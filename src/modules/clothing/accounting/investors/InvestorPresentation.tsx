'use client';

import type { ReactNode } from 'react';
import { MonthPickerInput } from '@mantine/dates';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconBuildingBank,
  IconCalendar,
  IconDownload,
  IconLayoutDashboard,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUsers,
} from '@tabler/icons-react';
import { ControlPanelCard } from '@/components/ui/ControlPanelCard';
import { AccountingTableCard } from '@/app/clothing/accounting/components/AccountingTableCard';
import {
  ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
  ACCOUNTING_TABLE_TD_TEXT_STYLE,
  accountingThStyle,
} from '@/app/clothing/accounting/components/accountingTableStyles';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { formatDateOnly } from '@/utils/dateFormatters';

export function InvestorPayoutStatus({
  payout,
  today,
  onMarkPaid,
}: {
  payout: {
    status: string;
    dueDate: string | null;
    payment: { amount: string; paidDate: string } | null;
  };
  today: string;
  onMarkPaid: () => void;
}) {
  if (payout.payment) {
    return (
      <Tooltip label={`Paid on ${formatDateOnly(payout.payment.paidDate)}`}>
        <Badge color="green" variant="light">
          Paid
        </Badge>
      </Tooltip>
    );
  }
  if (payout.status === 'waived') {
    return (
      <Badge color="yellow" variant="light">
        March waived
      </Badge>
    );
  }
  if (payout.status === 'deferred') {
    return (
      <Badge color="gray" variant="light">
        Setup deferral
      </Badge>
    );
  }
  if (payout.dueDate && payout.dueDate <= today) {
    return (
      <Button
        size="compact-xs"
        variant="light"
        color="orange"
        onClick={onMarkPaid}
      >
        Mark paid
      </Button>
    );
  }
  return (
    <Badge color="teal" variant="light">
      Projected
    </Badge>
  );
}

export function InvestorPaymentConfirmation({
  opened,
  description,
  amount,
  paidDate,
  today,
  busy,
  error,
  onDateChange,
  onClose,
  onConfirm,
}: {
  opened: boolean;
  description: string;
  amount: string;
  paidDate: string;
  today: string;
  busy: boolean;
  error?: string;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <UniversalModal
      opened={opened}
      onClose={() => !busy && onClose()}
      title="Record investor payment"
      size="md"
    >
      <Stack>
        <Text>{description}</Text>
        {error && <Alert color="red">{error}</Alert>}
        <TextInput
          label="Actual amount paid"
          value={amount}
          readOnly
          required
        />
        <TextInput
          label="Payment date"
          type="date"
          value={paidDate}
          max={today}
          onChange={(event) => onDateChange(event.currentTarget.value)}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button color="green" loading={busy} onClick={onConfirm}>
            Confirm payment
          </Button>
        </Group>
      </Stack>
    </UniversalModal>
  );
}

interface InvestorControlsProps {
  tab: string | null;
  onTabChange: (value: string | null) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedName?: string;
  payoutMonth: string;
  onPayoutMonthChange: (value: string) => void;
  paidStatementCount: number;
  generatingStatements: boolean;
  onGenerateStatements: () => void;
  calendarYear: string;
  onCalendarYearChange: (value: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onAddInvestor: () => void;
  onAddClosure: () => void;
}

export function InvestorControls(props: InvestorControlsProps) {
  const searchInput = (label: string, placeholder: string) => (
    <TextInput
      aria-label={label}
      placeholder={placeholder}
      leftSection={<IconSearch size={16} />}
      value={props.search}
      onChange={(event) => props.onSearchChange(event.currentTarget.value)}
      style={{ flex: 1, minWidth: 200 }}
    />
  );
  const actions = (add?: { label: string; onClick: () => void }) => (
    <Group gap="xs" wrap="nowrap">
      <Tooltip label="Refresh investors">
        <ActionIcon
          aria-label="Refresh investors"
          variant="subtle"
          color="blue"
          loading={props.refreshing}
          onClick={props.onRefresh}
        >
          <IconRefresh size={18} />
        </ActionIcon>
      </Tooltip>
      {add && (
        <Button
          color="blue"
          leftSection={<IconPlus size={16} />}
          onClick={add.onClick}
        >
          {add.label}
        </Button>
      )}
    </Group>
  );

  return (
    <ControlPanelCard
      title="Investors"
      activeTab={props.tab}
      onTabChange={props.onTabChange}
      tabs={[
        {
          value: 'dashboard',
          label: 'Dashboard',
          leftSection: <IconLayoutDashboard size={16} />,
          panel: (
            <Group gap="md" justify="space-between" align="center" wrap="wrap">
              {searchInput(
                'Search dashboard',
                'Search investor or agreement...'
              )}
              {actions({ label: 'Add investor', onClick: props.onAddInvestor })}
            </Group>
          ),
        },
        {
          value: 'investors',
          label: 'Investors',
          leftSection: <IconUsers size={16} />,
          panel: (
            <Group gap="md" justify="space-between">
              {props.selectedName ? (
                <Text
                  fw={500}
                  style={{ overflowWrap: 'anywhere', minWidth: 0, flex: 1 }}
                >
                  {props.selectedName}
                </Text>
              ) : (
                searchInput(
                  'Search investors',
                  'Search name, email, or phone...'
                )
              )}
              {actions({ label: 'Add investor', onClick: props.onAddInvestor })}
            </Group>
          ),
        },
        {
          value: 'payouts',
          label: 'Payout schedule',
          leftSection: <IconCalendar size={16} />,
          panel: (
            <Group gap="md" justify="space-between" align="center" wrap="wrap">
              {searchInput('Search payouts', 'Search investor or agreement...')}
              <MonthPickerInput
                aria-label="Payment month"
                value={new Date(`${props.payoutMonth}-01T12:00:00`)}
                onChange={(date) => {
                  if (date) {
                    props.onPayoutMonthChange(
                      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                    );
                  }
                }}
                valueFormat="MMMM YYYY"
                nextLabel="Next year"
                previousLabel="Previous year"
                leftSection={<IconCalendar size={16} />}
                popoverProps={{ position: 'bottom-end', shadow: 'md' }}
                w={220}
              />
              <Group gap="xs" wrap="wrap">
                <Button
                  leftSection={<IconDownload size={16} />}
                  variant="light"
                  color="teal"
                  disabled={!props.paidStatementCount}
                  loading={props.generatingStatements}
                  onClick={props.onGenerateStatements}
                >
                  Download statements ({props.paidStatementCount})
                </Button>
                {actions()}
              </Group>
            </Group>
          ),
        },
        {
          value: 'calendar',
          label: 'Bank calendar',
          leftSection: <IconBuildingBank size={16} />,
          panel: (
            <Group gap="md" justify="space-between" align="center" wrap="wrap">
              {searchInput(
                'Search bank closures',
                'Search closure name or date...'
              )}
              <TextInput
                aria-label="Calendar year"
                type="number"
                min={1900}
                max={9999}
                value={props.calendarYear}
                onChange={(event) =>
                  props.onCalendarYearChange(event.currentTarget.value)
                }
                w={160}
              />
              {actions({
                label: 'Add bank closure',
                onClick: props.onAddClosure,
              })}
            </Group>
          ),
        },
      ]}
    />
  );
}

export function InvestorTable({
  children,
  minWidth = 650,
  height,
}: {
  children: ReactNode;
  minWidth?: number;
  height?: string;
}) {
  return (
    <AccountingTableCard overflowX="auto" height={height}>
      <Table
        highlightOnHover
        withTableBorder
        style={{ minWidth }}
        styles={{
          thead: ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
          th: {
            ...accountingThStyle(),
            textTransform: 'uppercase',
            fontSize: 'var(--mantine-font-size-sm)',
          },
          td: ACCOUNTING_TABLE_TD_TEXT_STYLE,
        }}
      >
        {children}
      </Table>
    </AccountingTableCard>
  );
}

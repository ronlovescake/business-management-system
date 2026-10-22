'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCopy,
  IconDownload,
  IconEdit,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  InvestorDashboard,
  InvestorDashboardMetrics,
} from './InvestorDashboard';
import { buildInvestorDashboard } from './dashboard';
import { AccountingTableSummaryCard } from '@/app/clothing/accounting/components/AccountingTableSummaryCard';
import {
  InvestorControls,
  InvestorTable,
  InvestorPayoutStatus,
  InvestorPaymentConfirmation,
} from './InvestorPresentation';
import { UniversalModal as Modal } from '@/components/modals/UniversalModal';
import type { AgreementInput, InvestorInput } from '@/lib/investors/validation';
import { InvestorEditorModal, type InvestorEditor } from './InvestorForms';
import type { buildInvestmentSchedule } from '@/lib/investors/schedule';
import { formatDateOnly } from '@/utils/dateFormatters';
import { getCurrentDateISO } from '@/utils/date';
import { FormatterService } from '@/services/FormatterService';
import { useAgreementStatement } from './useAgreementStatement';
import { useInvestorStatements } from './useInvestorStatements';
import {
  InvestorAccounting,
  type InvestorAccountingState,
} from './InvestorAccounting';

type SchedulePayout = ReturnType<
  typeof buildInvestmentSchedule
>['payouts'][number] & {
  payment: { amount: string; paidDate: string } | null;
};
type Schedule = Omit<ReturnType<typeof buildInvestmentSchedule>, 'payouts'> & {
  payouts: SchedulePayout[];
};
type Agreement = AgreementInput & {
  id: string;
  schedule: Schedule;
  accounting: InvestorAccountingState;
};
type Investor = InvestorInput & {
  id: string;
  investorCode: string;
  agreements: Agreement[];
};
type Closure = { id: string; date: string; name: string };
type Portfolio = { investors: Investor[]; closures: Closure[] };
type PaymentTarget = SchedulePayout & {
  agreementId: string;
  reference: string;
  investorName: string;
};

const endpoint = '/api/clothing/investors';
const queryKey = ['clothing-investors'];
const money = (cents: number) => FormatterService.formatCurrency(cents / 100);

async function request<T>(method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(endpoint, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Unable to load investors');
  }
  return result as T;
}

export default function InvestorsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey, queryFn: () => request<Portfolio>() });
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [editor, setEditor] = useState<InvestorEditor | null>(null);
  const [closureToRemove, setClosureToRemove] = useState<Closure | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(
    null
  );
  const [paymentDate, setPaymentDate] = useState(getCurrentDateISO());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [tab, setTab] = useState<string | null>('dashboard');
  const search = searches[tab ?? 'investors'] ?? '';
  const setSearch = (value: string) =>
    setSearches((previous) => ({ ...previous, [tab ?? 'investors']: value }));
  const [payoutMonth, setPayoutMonth] = useState(
    getCurrentDateISO().slice(0, 7)
  );
  const [calendarYear, setCalendarYear] = useState(
    getCurrentDateISO().slice(0, 4)
  );
  const mutation = useMutation({
    mutationFn: ({
      method,
      body,
    }: {
      method: string;
      body: unknown;
      successMessage: string;
    }) => request(method, body),
    onSuccess: async (_result, variables) => {
      await client.invalidateQueries();
      setEditor(null);
      setClosureToRemove(null);
      setPaymentTarget(null);
      showNotification({ message: variables.successMessage, color: 'green' });
    },
    onError: (error: Error) =>
      showNotification({ message: error.message, color: 'red' }),
  });
  const { isGenerating: generatingStatements, generate: generateStatements } =
    useInvestorStatements();
  const {
    isDownloading: downloadingAgreementStatement,
    download: downloadAgreementStatement,
    downloadedAgreementId,
    copyEmail: copyStatementEmail,
  } = useAgreementStatement();

  const investors = query.data?.investors ?? [];
  const closures = query.data?.closures ?? [];
  const filteredInvestors = investors.filter((investor) =>
    `${investor.investorCode} ${investor.name} ${investor.email} ${investor.phone}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const yearClosures = closures.filter((closure) =>
    closure.date.startsWith(calendarYear)
  );
  const visibleClosures = yearClosures.filter((closure) =>
    `${closure.name} ${closure.date} ${formatDateOnly(closure.date)}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );
  const selected = investors.find((investor) => investor.id === selectedId);
  const agreements = investors.flatMap((investor) =>
    investor.agreements.map((agreement) => ({
      ...agreement,
      investorName: investor.name,
    }))
  );
  const agreement =
    selected?.agreements.find((item) => item.id === agreementId) ??
    selected?.agreements[0];
  const today = getCurrentDateISO();
  const dashboard = buildInvestorDashboard(investors, today);
  const monthlyPayouts = agreements
    .flatMap((item) =>
      item.schedule.payouts
        .filter(
          (payout) =>
            payout.dueDate?.startsWith(payoutMonth) ||
            (payout.status === 'scheduled' &&
              !payout.payment &&
              payout.dueDate &&
              payout.dueDate <= today)
        )
        .map((payout) => ({
          ...payout,
          agreementId: item.id,
          reference: item.reference,
          investorName: item.investorName,
        }))
    )
    .sort((left, right) =>
      (left.dueDate ?? '').localeCompare(right.dueDate ?? '')
    );
  const paidStatementCount = monthlyPayouts.filter(
    (payout) => payout.payment && payout.dueDate?.startsWith(payoutMonth)
  ).length;
  const visiblePayouts = monthlyPayouts.filter((payout) =>
    `${payout.investorName} ${payout.reference}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );
  const save = (
    kind: 'investor' | 'agreement' | 'closure',
    data: unknown,
    id?: string
  ) =>
    mutation.mutate({
      method: id ? 'PUT' : 'POST',
      body: { kind, id, data },
      successMessage: 'Investor records saved',
    });
  const openPaymentEditor = (target: PaymentTarget) => {
    setPaymentTarget(target);
    setPaymentDate(getCurrentDateISO());
    setPaymentAmount((target.amountCents / 100).toFixed(2));
  };
  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg" style={{ minWidth: 0 }}>
        {query.isPending && (
          <Group justify="center" p="xl">
            <Loader />
            <Text>Loading investors...</Text>
          </Group>
        )}
        {query.isError && (
          <Alert
            color="red"
            title="Unable to load investors"
            icon={<IconAlertCircle />}
          >
            <Text>{query.error.message}</Text>
            <Button variant="subtle" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </Alert>
        )}

        {query.data && (
          <>
            <InvestorDashboardMetrics data={dashboard} />
            <InvestorControls
              tab={tab}
              onTabChange={setTab}
              search={search}
              onSearchChange={setSearch}
              selectedName={selected?.name}
              payoutMonth={payoutMonth}
              onPayoutMonthChange={setPayoutMonth}
              paidStatementCount={paidStatementCount}
              generatingStatements={generatingStatements}
              onGenerateStatements={() => void generateStatements(payoutMonth)}
              calendarYear={calendarYear}
              onCalendarYearChange={setCalendarYear}
              refreshing={query.isFetching}
              onRefresh={() => void query.refetch()}
              onAddInvestor={() => setEditor({ kind: 'investor' })}
              onAddClosure={() => setEditor({ kind: 'closure' })}
            />
            {tab === 'dashboard' && (
              <InvestorDashboard
                data={dashboard}
                today={today}
                search={search}
                closureYears={closures.map((closure) =>
                  closure.date.slice(0, 4)
                )}
                onMarkPaid={openPaymentEditor}
                onOpenInvestor={(id, targetAgreementId) => {
                  setSelectedId(id);
                  setAgreementId(targetAgreementId ?? null);
                  setTab('investors');
                }}
              />
            )}
            {tab === 'investors' && (
              <Box style={{ minWidth: 0 }}>
                {!selected ? (
                  <Stack gap="md">
                    <InvestorTable>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Investor</Table.Th>
                          <Table.Th>Contact</Table.Th>
                          <Table.Th>Agreements</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>
                            Total invested
                          </Table.Th>
                          <Table.Th>Portfolio</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {!filteredInvestors.length && (
                          <Table.Tr>
                            <Table.Td colSpan={5}>
                              <Text c="dimmed" ta="center" py="xl">
                                {investors.length
                                  ? 'No matching investors.'
                                  : 'No investors recorded.'}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {filteredInvestors.map((investor) => (
                          <Table.Tr key={investor.id}>
                            <Table.Td>
                              <Text fw={600}>{investor.name}</Text>
                              <Text size="xs" c="dimmed">
                                {investor.investorCode}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {investor.email || investor.phone || '-'}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="center">
                              {investor.agreements.length}
                            </Table.Td>
                            <Table.Td ta="right" fw={600}>
                              {FormatterService.formatCurrency(
                                investor.agreements.reduce(
                                  (total, item) =>
                                    total + Number(item.principal),
                                  0
                                )
                              )}
                            </Table.Td>
                            <Table.Td ta="center">
                              <Button
                                color="blue"
                                variant="subtle"
                                size="compact-sm"
                                onClick={() => {
                                  setSelectedId(investor.id);
                                  setAgreementId(null);
                                }}
                              >
                                View portfolio
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </InvestorTable>
                    <AccountingTableSummaryCard
                      leftText={`Showing ${filteredInvestors.length} of ${investors.length} investors`}
                      items={[
                        {
                          label: 'Total invested:',
                          value: FormatterService.formatCurrency(
                            filteredInvestors.reduce(
                              (total, investor) =>
                                total +
                                investor.agreements.reduce(
                                  (subtotal, item) =>
                                    subtotal + Number(item.principal),
                                  0
                                ),
                              0
                            )
                          ),
                        },
                      ]}
                    />
                  </Stack>
                ) : (
                  <Stack gap="lg">
                    <Group justify="space-between">
                      <Group>
                        <Tooltip label="Back to investors">
                          <ActionIcon
                            aria-label="Back to investors"
                            variant="subtle"
                            onClick={() => setSelectedId(null)}
                          >
                            <IconArrowLeft size={20} />
                          </ActionIcon>
                        </Tooltip>
                        <Title order={3} style={{ overflowWrap: 'anywhere' }}>
                          {selected.name}
                        </Title>
                        <Text size="sm" c="dimmed">
                          {selected.investorCode}
                        </Text>
                      </Group>
                      <Button
                        color="blue"
                        variant="light"
                        leftSection={<IconEdit size={16} />}
                        onClick={() =>
                          setEditor({ kind: 'investor', record: selected })
                        }
                      >
                        Edit investor
                      </Button>
                    </Group>
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <Stack gap={4}>
                        <Text size="sm" c="dimmed">
                          Contact
                        </Text>
                        <Text>{selected.email || '-'}</Text>
                        <Text>{selected.phone || '-'}</Text>
                        <Text style={{ overflowWrap: 'anywhere' }}>
                          {selected.address || '-'}
                        </Text>
                      </Stack>
                      <Stack gap={4}>
                        <Text size="sm" c="dimmed">
                          Bank account
                        </Text>
                        <Text>{selected.bankName || '-'}</Text>
                        <Text>{selected.accountName || '-'}</Text>
                        <Text>{selected.accountNumber || '-'}</Text>
                      </Stack>
                    </SimpleGrid>
                    {selected.notes && (
                      <Text
                        style={{
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {selected.notes}
                      </Text>
                    )}
                    <Group justify="space-between">
                      <Title order={4}>Agreements</Title>
                      <Button
                        color="blue"
                        leftSection={<IconPlus size={16} />}
                        onClick={() =>
                          setEditor({
                            kind: 'agreement',
                            investorId: selected.id,
                          })
                        }
                      >
                        Add agreement
                      </Button>
                    </Group>
                    {!selected.agreements.length && (
                      <Text c="dimmed">No agreements recorded.</Text>
                    )}
                    {agreement && (
                      <>
                        <Group align="end">
                          <Select
                            label="Agreement"
                            value={agreement.id}
                            onChange={setAgreementId}
                            data={selected.agreements.map((item) => ({
                              value: item.id,
                              label: item.reference,
                            }))}
                            style={{ flex: 1, minWidth: 180 }}
                          />
                          <Tooltip label="Edit agreement">
                            <ActionIcon
                              size="lg"
                              variant="light"
                              aria-label="Edit agreement"
                              onClick={() =>
                                setEditor({
                                  kind: 'agreement',
                                  investorId: selected.id,
                                  record: agreement,
                                })
                              }
                            >
                              <IconEdit size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Button
                            variant="light"
                            leftSection={<IconDownload size={16} />}
                            loading={downloadingAgreementStatement}
                            onClick={() =>
                              void downloadAgreementStatement(
                                agreement.id,
                                agreement.reference,
                                selected.name
                              )
                            }
                          >
                            Download statement
                          </Button>
                          {downloadedAgreementId === agreement.id && (
                            <Button
                              variant="light"
                              color="teal"
                              leftSection={<IconCopy size={16} />}
                              onClick={() =>
                                void copyStatementEmail(
                                  selected.name,
                                  agreement.reference
                                )
                              }
                            >
                              Copy email
                            </Button>
                          )}
                        </Group>
                        <InvestorAccounting
                          key={agreement.id}
                          agreement={agreement}
                        />
                        {agreement.notes && (
                          <Text
                            style={{
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {agreement.notes}
                          </Text>
                        )}
                        <Title order={4}>Projected returns</Title>
                        <InvestorTable minWidth={620}>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Month</Table.Th>
                              <Table.Th>Anniversary</Table.Th>
                              <Table.Th>Banking date</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                Return
                              </Table.Th>
                              <Table.Th>Status</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {agreement.schedule.payouts.map((payout) => (
                              <Table.Tr key={payout.month}>
                                <Table.Td>{payout.month}</Table.Td>
                                <Table.Td>
                                  {formatDateOnly(payout.anniversaryDate)}
                                </Table.Td>
                                <Table.Td>
                                  {payout.dueDate
                                    ? formatDateOnly(payout.dueDate)
                                    : '-'}
                                </Table.Td>
                                <Table.Td ta="right" fw={600}>
                                  {payout.payment
                                    ? FormatterService.formatCurrency(
                                        Number(payout.payment.amount)
                                      )
                                    : money(payout.amountCents)}
                                </Table.Td>
                                <Table.Td ta="center">
                                  <InvestorPayoutStatus
                                    payout={payout}
                                    today={today}
                                    onMarkPaid={() =>
                                      openPaymentEditor({
                                        ...payout,
                                        agreementId: agreement.id,
                                        reference: agreement.reference,
                                        investorName: selected.name,
                                      })
                                    }
                                  />
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </InvestorTable>
                        <AccountingTableSummaryCard
                          leftText={`${agreement.schedule.payouts.length} monthly anniversaries`}
                          items={[
                            {
                              label: 'Projected returns:',
                              value: money(
                                agreement.schedule.payouts.reduce(
                                  (total, payout) => total + payout.amountCents,
                                  0
                                )
                              ),
                            },
                          ]}
                        />
                      </>
                    )}
                  </Stack>
                )}
              </Box>
            )}

            {tab === 'payouts' && (
              <Stack gap="md">
                <InvestorTable>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Banking date</Table.Th>
                      <Table.Th>Investor</Table.Th>
                      <Table.Th>Agreement</Table.Th>
                      <Table.Th>Return month</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Return</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {!visiblePayouts.length && (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text c="dimmed" ta="center" py="xl">
                            No matching payouts.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {visiblePayouts.map((payout) => (
                      <Table.Tr key={`${payout.agreementId}-${payout.month}`}>
                        <Table.Td>
                          {payout.dueDate
                            ? formatDateOnly(payout.dueDate)
                            : '-'}
                        </Table.Td>
                        <Table.Td>{payout.investorName}</Table.Td>
                        <Table.Td>{payout.reference}</Table.Td>
                        <Table.Td>
                          {formatDateOnly(payout.anniversaryDate)}
                        </Table.Td>
                        <Table.Td ta="right" fw={600}>
                          {payout.payment
                            ? FormatterService.formatCurrency(
                                Number(payout.payment.amount)
                              )
                            : money(payout.amountCents)}
                        </Table.Td>
                        <Table.Td ta="center">
                          <InvestorPayoutStatus
                            payout={payout}
                            today={today}
                            onMarkPaid={() => openPaymentEditor(payout)}
                          />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </InvestorTable>
                <AccountingTableSummaryCard
                  leftText={`${visiblePayouts.length} projected payouts`}
                  items={[
                    {
                      label: 'Projected returns:',
                      value: money(
                        visiblePayouts.reduce(
                          (total, payout) => total + payout.amountCents,
                          0
                        )
                      ),
                    },
                  ]}
                />
              </Stack>
            )}

            {tab === 'calendar' && (
              <Stack gap="md">
                {!yearClosures.length && (
                  <Alert
                    color="yellow"
                    title="No bank closures recorded for this year"
                  >
                    Holiday adjustments are incomplete for {calendarYear}.
                  </Alert>
                )}
                <InvestorTable minWidth={500}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Bank closure</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {!visibleClosures.length && (
                      <Table.Tr>
                        <Table.Td colSpan={3}>
                          <Text c="dimmed" ta="center" py="xl">
                            No matching bank closures.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {visibleClosures.map((closure) => (
                      <Table.Tr key={closure.id}>
                        <Table.Td>{formatDateOnly(closure.date)}</Table.Td>
                        <Table.Td>{closure.name}</Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="center" wrap="nowrap">
                            <Tooltip label="Edit bank closure">
                              <ActionIcon
                                variant="subtle"
                                aria-label={`Edit ${closure.name}`}
                                onClick={() =>
                                  setEditor({
                                    kind: 'closure',
                                    record: closure,
                                  })
                                }
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Remove bank closure">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Remove ${closure.name}`}
                                onClick={() => setClosureToRemove(closure)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </InvestorTable>
                <AccountingTableSummaryCard
                  leftText={`${visibleClosures.length} bank closures`}
                  items={[{ label: 'Calendar year:', value: calendarYear }]}
                />
              </Stack>
            )}
          </>
        )}

        <InvestorEditorModal
          editor={editor}
          busy={mutation.isPending}
          error={mutation.isError ? mutation.error.message : undefined}
          onClose={() => setEditor(null)}
          onSave={save}
        />
        <InvestorPaymentConfirmation
          opened={paymentTarget !== null}
          description={
            paymentTarget
              ? `Confirm that ${money(paymentTarget.amountCents)} for month ${paymentTarget.month} was transferred to ${paymentTarget.investorName} (${paymentTarget.reference}) and has not already been entered in accounting. This posts Investor Return Expense against Cash; investment is unchanged.`
              : ''
          }
          amount={paymentAmount}
          paidDate={paymentDate}
          today={today}
          busy={mutation.isPending}
          error={mutation.isError ? mutation.error.message : undefined}
          onDateChange={setPaymentDate}
          onClose={() => setPaymentTarget(null)}
          onConfirm={() =>
            paymentTarget &&
            mutation.mutate({
              method: 'POST',
              successMessage: 'Payout marked as paid',
              body: {
                kind: 'payment',
                data: {
                  agreementId: paymentTarget.agreementId,
                  month: paymentTarget.month,
                  amount: paymentAmount,
                  paidDate: paymentDate,
                },
              },
            })
          }
        />
        <Modal
          opened={closureToRemove !== null}
          onClose={() => !mutation.isPending && setClosureToRemove(null)}
          title="Remove bank closure"
        >
          <Stack>
            <Text>
              Remove {closureToRemove?.name} on{' '}
              {closureToRemove ? formatDateOnly(closureToRemove.date) : ''}?
              Projected banking dates will be recalculated.
            </Text>
            <Button
              color="red"
              loading={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  method: 'DELETE',
                  body: { date: closureToRemove?.date },
                  successMessage: 'Bank closure removed',
                })
              }
            >
              Remove closure
            </Button>
          </Stack>
        </Modal>
      </Stack>
    </PageLayout>
  );
}

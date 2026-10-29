'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconCash, IconCashBanknote } from '@tabler/icons-react';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { getCurrentDateISO } from '@/utils/date';
import { formatDateOnly } from '@/utils/dateFormatters';
import { FormatterService } from '@/services/FormatterService';

export interface InvestorAccountingState {
  fundedDate: string | null;
  repaidDate: string | null;
  unpostedPayments: number;
}

export function InvestorAccounting({
  agreement,
}: {
  agreement: {
    id: string;
    reference: string;
    principal: string;
    monthlyRateBps: number;
    effectiveDate: string;
    accounting: InvestorAccountingState;
    schedule: {
      maturityDate: string;
      eligibleDate: string;
      principalRepaymentDeadline: string;
    };
  };
}) {
  const client = useQueryClient();
  const [action, setAction] = useState<'funding' | 'repayment' | null>(null);
  const [date, setDate] = useState(getCurrentDateISO());
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/clothing/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: action,
          data: { agreementId: agreement.id, date },
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to post investor movement');
      }
    },
    onSuccess: async () => {
      setAction(null);
      await client.invalidateQueries();
    },
  });
  const state = agreement.accounting;
  const money = FormatterService.formatCurrency(Number(agreement.principal));
  const metrics = [
    ['Investment', money],
    ['Monthly rate', `${agreement.monthlyRateBps / 100}%`],
    ['Effective date', formatDateOnly(agreement.effectiveDate)],
    ['Maturity', formatDateOnly(agreement.schedule.maturityDate)],
    ['Setup ends', formatDateOnly(agreement.schedule.eligibleDate)],
    [
      'Investment repayment deadline',
      formatDateOnly(agreement.schedule.principalRepaymentDeadline),
    ],
  ];
  const entryLines =
    action === 'repayment'
      ? [
          ['Debit', 'Investor Funding Payable'],
          ['Credit', 'Cash'],
        ]
      : [
          ['Debit', 'Cash'],
          ['Credit', 'Investor Funding Payable'],
        ];
  const open = (kind: 'funding' | 'repayment') => {
    mutation.reset();
    setDate(getCurrentDateISO());
    setConfirmed(false);
    setAction(kind);
  };
  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {metrics.map(([label, value]) => (
          <Box key={label} style={{ minWidth: 0 }}>
            <Text size="sm" c="dimmed">
              {label}
            </Text>
            <Text fw={600} size="lg" style={{ overflowWrap: 'anywhere' }}>
              {value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
      <Group wrap="wrap">
        {state.fundedDate ? (
          <Badge color="green">
            Funding posted {formatDateOnly(state.fundedDate)}
          </Badge>
        ) : (
          <Button
            leftSection={<IconCash size={16} />}
            onClick={() => open('funding')}
          >
            Record funding received
          </Button>
        )}
        {state.repaidDate ? (
          <Badge color="gray">
            Investment repaid {formatDateOnly(state.repaidDate)}
          </Badge>
        ) : (
          <Button
            variant="light"
            leftSection={<IconCashBanknote size={16} />}
            disabled={
              !state.fundedDate ||
              agreement.schedule.maturityDate > getCurrentDateISO()
            }
            onClick={() => open('repayment')}
          >
            Record Investment Repayment
          </Button>
        )}
      </Group>
      {!state.fundedDate && (
        <Alert color="yellow">
          Funding is not linked to an investor journal entry. Check existing
          opening balances and manual entries before posting.
        </Alert>
      )}
      {state.unpostedPayments > 0 && (
        <Alert color="yellow">
          {state.unpostedPayments} historical paid return(s) have no linked
          journal posting and require reconciliation.
        </Alert>
      )}
      <UniversalModal
        opened={action !== null}
        onClose={() => !mutation.isPending && setAction(null)}
        title={
          action === 'funding'
            ? 'Record funding received'
            : 'Record Investment Repayment'
        }
        size="xl"
        centered
      >
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Text size="sm" c="dimmed">
                Agreement
              </Text>
              <Text fw={700} size="lg">
                {agreement.reference}
              </Text>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Text size="sm" c="dimmed">
                Amount
              </Text>
              <Text fw={700} size="lg">
                {money}
              </Text>
            </Paper>
          </SimpleGrid>
          <Paper withBorder radius="md" p="md">
            <Text fw={600} mb="sm">
              Journal entry
            </Text>
            <Stack gap="xs">
              {entryLines.map(([side, account]) => (
                <Group key={side} justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <Badge
                      variant="light"
                      color={side === 'Debit' ? 'blue' : 'grape'}
                      w={72}
                    >
                      {side}
                    </Badge>
                    <Text>{account}</Text>
                  </Group>
                  <Text fw={600}>{money}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>
          <TextInput
            label={action === 'funding' ? 'Date received' : 'Date repaid'}
            type="date"
            value={date}
            max={getCurrentDateISO()}
            onChange={(event) => setDate(event.currentTarget.value)}
            required
          />
          <Paper withBorder radius="md" p="md" bg="gray.0">
            <Checkbox
              label="I confirm the funds moved and this movement is not already included in opening balances or another journal entry."
              checked={confirmed}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
            />
          </Paper>
          {mutation.isError && (
            <Alert color="red">{mutation.error.message}</Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>
            <Button
              loading={mutation.isPending}
              disabled={!confirmed || !date}
              onClick={() => mutation.mutate()}
            >
              Confirm and post
            </Button>
          </Group>
        </Stack>
      </UniversalModal>
    </Stack>
  );
}

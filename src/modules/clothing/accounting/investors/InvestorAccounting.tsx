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
    ['Principal', money],
    ['Monthly rate', `${agreement.monthlyRateBps / 100}%`],
    ['Effective date', formatDateOnly(agreement.effectiveDate)],
    ['Maturity', formatDateOnly(agreement.schedule.maturityDate)],
    ['Setup ends', formatDateOnly(agreement.schedule.eligibleDate)],
    [
      'Principal repayment deadline',
      formatDateOnly(agreement.schedule.principalRepaymentDeadline),
    ],
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
            Principal repaid {formatDateOnly(state.repaidDate)}
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
            Record principal repayment
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
            : 'Record principal repayment'
        }
      >
        <Stack>
          <Text fw={600}>
            {agreement.reference}: {money}
          </Text>
          <Text>
            {action === 'funding'
              ? 'Debit Cash / Credit Investor Funding Payable'
              : 'Debit Investor Funding Payable / Credit Cash'}
          </Text>
          <TextInput
            label={action === 'funding' ? 'Date received' : 'Date repaid'}
            type="date"
            value={date}
            max={getCurrentDateISO()}
            onChange={(event) => setDate(event.currentTarget.value)}
            required
          />
          <Checkbox
            label="I confirm the funds moved and this movement is not already included in opening balances or another journal entry."
            checked={confirmed}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
          />
          {mutation.isError && (
            <Alert color="red">{mutation.error.message}</Alert>
          )}
          <Button
            loading={mutation.isPending}
            disabled={!confirmed || !date}
            onClick={() => mutation.mutate()}
          >
            Confirm and post
          </Button>
        </Stack>
      </UniversalModal>
    </Stack>
  );
}

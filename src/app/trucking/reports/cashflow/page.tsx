'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Group, Stack, Text, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  sourceType?: string | null;
}

interface Payment {
  id: string;
  paymentDate: string;
  amount: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    value
  );

const inRange = (date: string, start: Date | null, end: Date | null) => {
  if (!start && !end) {
    return true;
  }
  const ts = new Date(date).getTime();
  if (start && ts < start.getTime()) {
    return false;
  }
  if (end && ts > end.getTime()) {
    return false;
  }
  return true;
};

export default function CashflowReportPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const [expRes, payRes] = await Promise.all([
          fetch('/api/trucking/expenses'),
          fetch('/api/trucking/payments'),
        ]);

        if (!expRes.ok || !payRes.ok) {
          throw new Error('Failed to load data');
        }

        const expData = (await expRes.json()) as Expense[];
        const payData = (await payRes.json()) as Payment[];

        setExpenses(expData);
        setPayments(payData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    };

    void load();
  }, []);

  const totals = useMemo(() => {
    const filteredExpenses = expenses.filter((e) =>
      inRange(e.date, startDate, endDate)
    );
    const filteredPayments = payments.filter((p) =>
      inRange(p.paymentDate, startDate, endDate)
    );

    const expenseTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const paymentTotal = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    return { expenseTotal, paymentTotal };
  }, [expenses, payments, startDate, endDate]);

  return (
    <Stack gap="lg">
      <Title order={2}>Cashflow Report</Title>
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {' '}
          {error}{' '}
        </Alert>
      )}

      <Card withBorder padding="md">
        <Group grow>
          <DateInput
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
            {...COMMON_DATE_INPUT_PROPS}
          />
          <DateInput
            label="End Date"
            value={endDate}
            onChange={setEndDate}
            {...COMMON_DATE_INPUT_PROPS}
          />
        </Group>
      </Card>

      <Card withBorder padding="xl">
        <Stack gap="xs">
          <Text size="lg" fw={600}>
            Cash In (Payments)
          </Text>
          <Text size="xl">{formatCurrency(totals.paymentTotal)}</Text>
        </Stack>
        <Stack gap="xs" mt="md">
          <Text size="lg" fw={600}>
            Cash Out (Expenses)
          </Text>
          <Text size="xl">{formatCurrency(totals.expenseTotal)}</Text>
        </Stack>
        <Stack gap="xs" mt="md">
          <Text size="lg" fw={600}>
            Net
          </Text>
          <Text size="xl">
            {formatCurrency(totals.paymentTotal - totals.expenseTotal)}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}

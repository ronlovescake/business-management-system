'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle, IconPlus, IconRefresh } from '@tabler/icons-react';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
} from '@/lib/dateInputConfig';

interface Allocation {
  id: string;
  invoiceId: string;
  amount: number;
}

interface Payment {
  id: string;
  customerId: string;
  paymentDate: string;
  amount: number;
  method: string;
  referenceNo: string | null;
  notes: string | null;
  allocations?: Allocation[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    value
  );

export default function TruckingPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  const [allocInvoiceId, setAllocInvoiceId] = useState('');
  const [allocAmount, setAllocAmount] = useState<number | ''>('');

  const loadPayments = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/trucking/payments');
      if (!res.ok) {
        throw new Error('Failed to load payments');
      }
      const data = (await res.json()) as Payment[];
      setPayments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayments();
  }, []);

  const totals = useMemo(
    () =>
      payments.map((p) => ({
        id: p.id,
        allocated: (p.allocations ?? []).reduce((sum, a) => sum + a.amount, 0),
      })),
    [payments]
  );

  const getAllocated = (id: string) =>
    totals.find((t) => t.id === id)?.allocated ?? 0;

  const handleCreate = async () => {
    setError(null);
    try {
      const allocations =
        allocInvoiceId && allocAmount !== ''
          ? [{ invoiceId: allocInvoiceId, amount: allocAmount }]
          : [];
      const payload = {
        customerId,
        paymentDate: formatDateForInput(paymentDate),
        amount: amount === '' ? 0 : amount,
        method,
        referenceNo: referenceNo || null,
        notes: notes || null,
        allocations,
      };

      const res = await fetch('/api/trucking/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to create payment');
      }

      await loadPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment');
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>Trucking Payments</Title>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={() => void loadPayments()}
        >
          Refresh
        </Button>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      )}

      <Card withBorder padding="md">
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Customer ID"
              placeholder="customer-123"
              value={customerId}
              onChange={(e) => setCustomerId(e.currentTarget.value)}
            />
            <DateInput
              label="Payment Date"
              value={paymentDate}
              onChange={setPaymentDate}
              valueFormat="YYYY-MM-DD"
              {...COMMON_DATE_INPUT_PROPS}
            />
            <NumberInput
              label="Amount"
              value={amount}
              onChange={(value) =>
                setAmount(value === '' || value === null ? '' : Number(value))
              }
              min={0}
              thousandSeparator=","
              prefix="₱ "
            />
            <TextInput
              label="Method"
              placeholder="cash/bank/gcash"
              value={method}
              onChange={(e) => setMethod(e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Reference No."
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.currentTarget.value)}
            />
            <TextInput
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
            <TextInput
              label="Allocate to Invoice ID (optional)"
              value={allocInvoiceId}
              onChange={(e) => setAllocInvoiceId(e.currentTarget.value)}
            />
            <NumberInput
              label="Allocate Amount"
              value={allocAmount}
              onChange={(value) =>
                setAllocAmount(
                  value === '' || value === null ? '' : Number(value)
                )
              }
              min={0}
              thousandSeparator=","
              prefix="₱ "
            />
          </Group>
          <Group justify="flex-end">
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleCreate}
              disabled={loading}
            >
              Create Payment
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Table highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Payment</Table.Th>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Method</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Allocated</Table.Th>
              <Table.Th>Balance</Table.Th>
              <Table.Th>Reference</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {payments.map((p) => {
              const allocated = getAllocated(p.id);
              const balance = p.amount - allocated;
              return (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Text fw={600}>{p.id}</Text>
                  </Table.Td>
                  <Table.Td>{p.customerId}</Table.Td>
                  <Table.Td>{p.paymentDate}</Table.Td>
                  <Table.Td>
                    <Badge>{p.method}</Badge>
                  </Table.Td>
                  <Table.Td>{formatCurrency(p.amount)}</Table.Td>
                  <Table.Td>{formatCurrency(allocated)}</Table.Td>
                  <Table.Td>{formatCurrency(balance)}</Table.Td>
                  <Table.Td>{p.referenceNo || '—'}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

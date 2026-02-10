'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  NumberInput,
  Title,
  Badge,
  Alert,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle, IconPlus, IconRefresh } from '@tabler/icons-react';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
} from '@/lib/dateInputConfig';

interface Allocation {
  id: string;
  paymentId: string;
  amount: number;
}

interface Invoice {
  id: string;
  customerId: string;
  cutoffStart: string;
  cutoffEnd: string;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  totalAmount: number;
  notes?: string | null;
  allocations?: Allocation[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    value
  );

const toDateInput = (value: string | null) => value ?? '';

export default function TruckingInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [cutoffStart, setCutoffStart] = useState<Date | null>(new Date());
  const [cutoffEnd, setCutoffEnd] = useState<Date | null>(new Date());
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [status, setStatus] = useState('DRAFT');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');

  const [genCustomerId, setGenCustomerId] = useState('');
  const [genCutoffStart, setGenCutoffStart] = useState<Date | null>(new Date());
  const [genCutoffEnd, setGenCutoffEnd] = useState<Date | null>(new Date());
  const [genInvoiceDate, setGenInvoiceDate] = useState<Date | null>(new Date());
  const [genDueDate, setGenDueDate] = useState<Date | null>(new Date());

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trucking/invoices');
      if (!res.ok) {
        throw new Error('Failed to load invoices');
      }
      const data = (await res.json()) as Invoice[];
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvoices();
  }, []);

  const totals = useMemo(() => {
    const allocationSum = (inv: Invoice) =>
      (inv.allocations ?? []).reduce((sum, a) => sum + a.amount, 0);

    return invoices.map((inv) => ({
      id: inv.id,
      allocated: allocationSum(inv),
      balance: inv.totalAmount - allocationSum(inv),
    }));
  }, [invoices]);

  const getBalance = (id: string) =>
    totals.find((t) => t.id === id)?.balance ?? 0;
  const getAllocated = (id: string) =>
    totals.find((t) => t.id === id)?.allocated ?? 0;

  const handleCreate = async () => {
    setError(null);
    try {
      const payload = {
        customerId,
        cutoffStart: formatDateForInput(cutoffStart),
        cutoffEnd: formatDateForInput(cutoffEnd),
        invoiceDate: formatDateForInput(invoiceDate),
        dueDate: formatDateForInput(dueDate) || null,
        status,
        totalAmount: totalAmount === '' ? 0 : totalAmount,
      };

      const res = await fetch('/api/trucking/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to create invoice');
      }

      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    }
  };

  const handleGenerate = async () => {
    setError(null);
    try {
      const payload = {
        customerId: genCustomerId,
        cutoffStart: formatDateForInput(genCutoffStart),
        cutoffEnd: formatDateForInput(genCutoffEnd),
        invoiceDate: formatDateForInput(genInvoiceDate),
        dueDate: formatDateForInput(genDueDate) || null,
        status: 'DRAFT',
      };

      const res = await fetch('/api/trucking/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to generate invoice');
      }

      await loadInvoices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate invoice'
      );
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>Trucking Invoices</Title>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={() => void loadInvoices()}
          >
            Refresh
          </Button>
        </Group>
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
              label="Cutoff Start"
              value={cutoffStart}
              onChange={setCutoffStart}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <DateInput
              label="Cutoff End"
              value={cutoffEnd}
              onChange={setCutoffEnd}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <DateInput
              label="Invoice Date"
              value={invoiceDate}
              onChange={setInvoiceDate}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <DateInput
              label="Due Date"
              value={dueDate}
              onChange={setDueDate}
              clearable
              {...COMMON_DATE_INPUT_PROPS}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Status"
              placeholder="DRAFT"
              value={status}
              onChange={(e) => setStatus(e.currentTarget.value)}
            />
            <NumberInput
              label="Total Amount"
              value={totalAmount}
              onChange={(value) =>
                setTotalAmount(
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
              Create Invoice
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="md">
          <Group gap="md" grow>
            <TextInput
              label="Customer ID"
              placeholder="customer-123"
              value={genCustomerId}
              onChange={(e) => setGenCustomerId(e.currentTarget.value)}
            />
            <DateInput
              label="Cutoff Start"
              value={genCutoffStart}
              onChange={setGenCutoffStart}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <DateInput
              label="Cutoff End"
              value={genCutoffEnd}
              onChange={setGenCutoffEnd}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <DateInput
              label="Invoice Date"
              value={genInvoiceDate}
              onChange={setGenInvoiceDate}
              {...COMMON_DATE_INPUT_PROPS}
            />
            <DateInput
              label="Due Date"
              value={genDueDate}
              onChange={setGenDueDate}
              clearable
              {...COMMON_DATE_INPUT_PROPS}
            />
          </Group>
          <Group justify="flex-end">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={loading}
            >
              Generate from Completed Trips
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Table highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Invoice</Table.Th>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Cutoff</Table.Th>
              <Table.Th>Invoice Date</Table.Th>
              <Table.Th>Due Date</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Allocated</Table.Th>
              <Table.Th>Balance</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((inv) => {
              const allocated = getAllocated(inv.id);
              const balance = getBalance(inv.id);
              return (
                <Table.Tr key={inv.id}>
                  <Table.Td>
                    <Text fw={600}>{inv.id}</Text>
                  </Table.Td>
                  <Table.Td>{inv.customerId}</Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {toDateInput(inv.cutoffStart)} →{' '}
                      {toDateInput(inv.cutoffEnd)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{toDateInput(inv.invoiceDate)}</Table.Td>
                  <Table.Td>{toDateInput(inv.dueDate)}</Table.Td>
                  <Table.Td>
                    <Badge color={inv.status === 'PAID' ? 'green' : 'blue'}>
                      {inv.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatCurrency(inv.totalAmount)}</Table.Td>
                  <Table.Td>{formatCurrency(allocated)}</Table.Td>
                  <Table.Td>{formatCurrency(balance)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

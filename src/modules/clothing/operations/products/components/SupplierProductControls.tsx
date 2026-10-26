'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconArrowsExchange,
  IconCreditCardRefund,
  IconReceipt,
} from '@tabler/icons-react';
import { showConfirm } from '@/lib/alerts';
import { randomUuid } from '@/lib/utils/randomUuid';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import { getCurrentDateISO } from '@/utils/date';
import type { ProductData, ProductFormData } from '../types/product.types';
import { ProductService } from '../services/ProductService';

type SupplierCredit = {
  id: string;
  supplierReference: string;
  reference: string;
  currency: string;
  amount: number;
  availableAmount: number;
  postingDate: string;
  sourceProduct: { id: number; productCode: string; product: string };
  applications: Array<{
    id: string;
    amount: number;
    targetProduct: { id: number; productCode: string };
  }>;
};

interface SupplierProductControlsProps {
  product?: ProductData;
  form: ProductFormData;
  grandTotal: number;
  updateField: (field: keyof ProductFormData, value: unknown) => void;
  onResolved?: () => Promise<void>;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    value
  );

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(
      body.error?.message ||
        body.message ||
        (typeof body.error === 'string'
          ? body.error
          : 'Supplier operation failed.')
    );
  }
  return body.data as T;
}

export function SupplierProductControls({
  product,
  form,
  grandTotal,
  updateField,
  onResolved,
}: SupplierProductControlsProps) {
  const { data: session } = useSession();
  const admin = ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role ?? '');
  const queryClient = useQueryClient();
  const [action, setAction] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [postingDate, setPostingDate] = useState(getCurrentDateISO());
  const [requestId, setRequestId] = useState(() => randomUuid());
  const [saving, setSaving] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [error, setError] = useState('');
  const {
    data: credits = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<SupplierCredit[]>({
    queryKey: ['clothing-supplier-credits'],
    queryFn: async () =>
      readResponse<SupplierCredit[]>(
        await fetch('/api/products/supplier-credits', { cache: 'no-store' })
      ),
    enabled: admin,
    retry: false,
  });
  if (!admin) {
    return null;
  }

  const supplier = (form.supplierReference ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const credit = credits.find(
    (item) =>
      item.id === form.supplierCreditId && item.supplierReference === supplier
  );
  const issued = credits.find((item) => item.sourceProduct.id === product?.id);
  const creditOptions = credits
    .filter(
      (item) =>
        item.supplierReference === supplier &&
        item.currency === 'PHP' &&
        item.availableAmount > 0 &&
        item.sourceProduct.id !== product?.id
    )
    .map((item) => ({
      value: item.id,
      label: `${item.reference} | ${item.sourceProduct.productCode} | ${money(item.availableAmount)}`,
    }));
  const purchaseAmount = product ? product['Grand Total'] : grandTotal;
  const appliedAmount = Number(form.supplierCreditAmount ?? 0);
  const canApply =
    Boolean(credit) &&
    appliedAmount > 0 &&
    appliedAmount <= Math.min(credit?.availableAmount ?? 0, purchaseAmount);
  const resolved = product?.['Supplier Fulfillment Status'] === 'CREDIT_ISSUED';
  const savedCreditApplied = Number(product?.['Supplier Credit Applied'] ?? 0);
  const savedForm = product ? ProductService.productToForm(product) : null;
  const unsavedEdits =
    savedForm &&
    (Object.keys(savedForm) as Array<keyof ProductFormData>).some(
      (field) =>
        ![
          'supplierReference',
          'supplierCreditId',
          'supplierCreditAmount',
          'supplierCreditRequestId',
        ].includes(field) &&
        field in form &&
        String(form[field] ?? '') !== String(savedForm[field] ?? '')
    );

  const submit = async () => {
    if (!product?.id || !action || saving || recorded || unsavedEdits) {
      return;
    }
    const confirmed = await showConfirm({
      title:
        action === 'TRANSFER'
          ? 'Transfer Delayed Product'
          : action === 'ISSUE_CREDIT'
            ? 'Confirm Supplier Nonfulfillment'
            : 'Apply Supplier Credit',
      message:
        action === 'TRANSFER'
          ? `${product['Product Code']}: ${product['Shipment Code']} to ${destination}. Preserve the original payment and purchase amount?`
          : action === 'ISSUE_CREDIT'
            ? `${product['Product Code']}: mark all ${product.Quantity} units missing and record ${money(product['Grand Total'])} supplier credit? The original cash/card payment remains recorded.`
            : `${product['Product Code']}: apply ${money(appliedAmount)} credit. Remaining purchase funding: ${money(purchaseAmount - appliedAmount)}.`,
      confirmButtonText:
        action === 'TRANSFER'
          ? 'Transfer Product'
          : action === 'ISSUE_CREDIT'
            ? 'Record Supplier Credit'
            : 'Apply Credit',
      cancelButtonText: 'Cancel',
      type: 'warning',
    });
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError('');
    let committed = false;
    try {
      const detail =
        action === 'TRANSFER'
          ? { shipmentCode: destination, reason }
          : action === 'ISSUE_CREDIT'
            ? { supplierReference: supplier, reference, postingDate }
            : {
                supplierReference: supplier,
                creditId: credit?.id,
                amount: appliedAmount,
                postingDate,
              };
      await readResponse(
        await fetch(`/api/products/${product.id}/supplier-resolution`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, requestId, ...detail }),
        })
      );
      committed = true;
      setRecorded(true);
      await queryClient.invalidateQueries();
      await onResolved?.();
    } catch (failure) {
      setError(
        committed
          ? 'The supplier action was recorded. Refresh this product before another action; do not submit it again.'
          : failure instanceof Error
            ? failure.message
            : 'Supplier operation failed.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack
      gap="sm"
      component="section"
      aria-label="Supplier funding and fulfillment"
    >
      <Divider />
      <Group justify="space-between" wrap="wrap">
        <Text fw={600}>Supplier Funding And Fulfillment</Text>
        {resolved && <Badge color="red">Supplier nonfulfillment</Badge>}
        {savedCreditApplied > 0 && (
          <Badge color="teal">
            Credit applied: {money(savedCreditApplied)}
          </Badge>
        )}
      </Group>
      {issued && (
        <Stack gap={2}>
          <Text size="sm">
            Credit {issued.reference}: {money(issued.amount)} | Available:{' '}
            {money(issued.availableAmount)}
          </Text>
          {issued.applications.map((application) => (
            <Text size="sm" key={application.id}>
              {application.targetProduct.productCode}:{' '}
              {money(application.amount)}
            </Text>
          ))}
        </Stack>
      )}
      {isError && (
        <Alert color="red" title="Supplier credits unavailable">
          <Button variant="subtle" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      )}
      {!resolved && (
        <>
          <TextInput
            label="Supplier reference"
            value={form.supplierReference ?? ''}
            onChange={(event) => {
              updateField('supplierReference', event.currentTarget.value);
              updateField('supplierCreditId', '');
              updateField('supplierCreditAmount', 0);
            }}
            disabled={
              saving || Number(product?.['Supplier Credit Applied'] ?? 0) > 0
            }
          />
          {product && (
            <Select
              label="Supplier resolution"
              clearable
              value={action}
              onChange={(value) => {
                setAction(value);
                setError('');
                setRequestId(randomUuid());
              }}
              disabled={saving || recorded}
              data={[
                {
                  value: 'TRANSFER',
                  label: 'Transfer delayed product',
                },
                {
                  value: 'ISSUE_CREDIT',
                  label: 'Record supplier credit',
                },
                {
                  value: 'APPLY_CREDIT',
                  label: 'Apply available credit',
                },
              ]}
            />
          )}
          {action === 'TRANSFER' && (
            <>
              <TextInput
                label="Destination shipment code"
                value={destination}
                onChange={(event) => setDestination(event.currentTarget.value)}
                disabled={saving}
              />
              <Textarea
                label="Transfer reason"
                value={reason}
                onChange={(event) => setReason(event.currentTarget.value)}
                disabled={saving}
              />
            </>
          )}
          {action === 'ISSUE_CREDIT' && (
            <>
              <TextInput
                label="Supplier credit reference"
                value={reference}
                onChange={(event) => setReference(event.currentTarget.value)}
                disabled={saving}
              />
              <Text fw={600}>Credit amount: {money(purchaseAmount)}</Text>
            </>
          )}
          {(!product || action === 'APPLY_CREDIT') && (
            <>
              <Select
                label="Available supplier credit"
                searchable
                clearable
                disabled={isLoading || saving || !supplier}
                value={credit?.id ?? null}
                data={creditOptions}
                onChange={(value) => {
                  updateField('supplierCreditId', value ?? '');
                  updateField(
                    'supplierCreditRequestId',
                    form.supplierCreditRequestId || randomUuid()
                  );
                  const selected = credits.find((item) => item.id === value);
                  updateField(
                    'supplierCreditAmount',
                    selected
                      ? Math.min(selected.availableAmount, purchaseAmount)
                      : 0
                  );
                }}
              />
              {credit && (
                <>
                  <NumberInput
                    label="Credit to apply (PHP)"
                    min={0.01}
                    max={Math.min(credit.availableAmount, purchaseAmount)}
                    decimalScale={2}
                    fixedDecimalScale
                    value={appliedAmount}
                    onChange={(value) =>
                      updateField('supplierCreditAmount', Number(value) || 0)
                    }
                    disabled={saving}
                  />
                  <Text size="sm">
                    Purchase amount: {money(purchaseAmount)} | Remaining
                    funding:{' '}
                    {money(Math.max(purchaseAmount - appliedAmount, 0))}
                  </Text>
                </>
              )}
            </>
          )}
          {product && action && action !== 'TRANSFER' && (
            <DateInput
              label="Supplier posting date"
              value={parseDateValue(postingDate)}
              onChange={(value) => setPostingDate(formatDateForInput(value))}
              {...COMMON_DATE_INPUT_PROPS}
              disabled={saving}
            />
          )}
          {product && action && unsavedEdits && (
            <Alert color="yellow">
              Save or discard other product edits before recording a supplier
              action.
            </Alert>
          )}
          {product && action && (
            <Group justify="flex-end">
              <Button
                loading={saving}
                onClick={() => void submit()}
                disabled={
                  Boolean(recorded || unsavedEdits) ||
                  (action === 'TRANSFER'
                    ? !destination.trim() || !reason.trim()
                    : action === 'ISSUE_CREDIT'
                      ? !supplier || !reference.trim() || !postingDate
                      : !canApply || !postingDate)
                }
                leftSection={
                  action === 'TRANSFER' ? (
                    <IconArrowsExchange size={16} />
                  ) : action === 'ISSUE_CREDIT' ? (
                    <IconCreditCardRefund size={16} />
                  ) : (
                    <IconReceipt size={16} />
                  )
                }
              >
                {action === 'TRANSFER'
                  ? 'Transfer Product'
                  : action === 'ISSUE_CREDIT'
                    ? 'Record Supplier Credit'
                    : 'Apply Credit'}
              </Button>
            </Group>
          )}
        </>
      )}
      {error && (
        <Alert
          color={recorded ? 'yellow' : 'red'}
          title={
            recorded
              ? 'Supplier action recorded'
              : 'Supplier resolution not completed'
          }
        >
          {error}
        </Alert>
      )}
    </Stack>
  );
}

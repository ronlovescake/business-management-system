'use client';

import { useState } from 'react';
import { useForm, zodResolver } from '@mantine/form';
import {
  Alert,
  Button,
  NumberInput,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  agreementInput,
  investorInput,
  type AgreementInput,
  type InvestorInput,
} from '@/lib/investors/validation';
import { getCurrentDateISO } from '@/utils/date';
import { UniversalModal } from '@/components/modals/UniversalModal';

export type InvestorEditor =
  | { kind: 'investor'; record?: InvestorInput & { id: string } }
  | {
      kind: 'agreement';
      investorId: string;
      record?: AgreementInput & { id: string };
    }
  | { kind: 'closure'; record?: { id: string; date: string; name: string } };

export function InvestorEditorModal({
  editor,
  busy,
  error,
  onClose,
  onSave,
}: {
  editor: InvestorEditor | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (
    kind: 'investor' | 'agreement' | 'closure',
    data: unknown,
    id?: string
  ) => void;
}) {
  const title =
    editor?.kind === 'investor'
      ? editor.record
        ? 'Edit investor'
        : 'Add investor'
      : editor?.kind === 'agreement'
        ? editor.record
          ? 'Edit agreement'
          : 'Add agreement'
        : 'Bank closure';
  return (
    <UniversalModal
      opened={editor !== null}
      onClose={() => !busy && onClose()}
      title={title}
      size="lg"
    >
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {editor?.kind === 'investor' && (
        <InvestorForm
          key={editor.record?.id ?? 'new'}
          record={editor.record}
          busy={busy}
          onSave={(data) => onSave('investor', data, editor.record?.id)}
        />
      )}
      {editor?.kind === 'agreement' && (
        <AgreementForm
          key={editor.record?.id ?? 'new'}
          investorId={editor.investorId}
          record={editor.record}
          busy={busy}
          onSave={(data) => onSave('agreement', data, editor.record?.id)}
        />
      )}
      {editor?.kind === 'closure' && (
        <ClosureForm
          key={editor.record?.id ?? 'new'}
          record={editor.record}
          busy={busy}
          onSave={(data) => onSave('closure', data)}
        />
      )}
    </UniversalModal>
  );
}

export function InvestorForm({
  record,
  busy,
  onSave,
}: {
  record?: InvestorInput;
  busy: boolean;
  onSave: (data: InvestorInput) => void;
}) {
  const form = useForm<InvestorInput>({
    initialValues: record ?? {
      name: '',
      email: '',
      phone: '',
      address: '',
      bankName: '',
      accountName: '',
      accountNumber: '',
      notes: '',
    },
    validate: zodResolver(investorInput),
  });
  return (
    <form onSubmit={form.onSubmit(onSave)}>
      <Stack>
        <TextInput
          label="Name"
          required
          maxLength={255}
          {...form.getInputProps('name')}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="Email"
            type="email"
            {...form.getInputProps('email')}
          />
          <TextInput label="Phone" {...form.getInputProps('phone')} />
        </SimpleGrid>
        <Textarea label="Address" {...form.getInputProps('address')} />
        <TextInput label="Bank" {...form.getInputProps('bankName')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="Account name"
            {...form.getInputProps('accountName')}
          />
          <TextInput
            label="Account number"
            {...form.getInputProps('accountNumber')}
          />
        </SimpleGrid>
        <Textarea label="Notes" {...form.getInputProps('notes')} />
        <Button type="submit" loading={busy}>
          Save investor
        </Button>
      </Stack>
    </form>
  );
}

export function AgreementForm({
  investorId,
  record,
  busy,
  onSave,
}: {
  investorId: string;
  record?: AgreementInput;
  busy: boolean;
  onSave: (data: AgreementInput) => void;
}) {
  const form = useForm<AgreementInput>({
    initialValues: record ?? {
      investorId,
      reference: '',
      effectiveDate: getCurrentDateISO(),
      principal: '',
      monthlyRateBps: 500,
      notes: '',
    },
    validate: zodResolver(agreementInput),
  });
  return (
    <form onSubmit={form.onSubmit(onSave)}>
      <Stack>
        <TextInput
          label="Agreement reference"
          required
          {...form.getInputProps('reference')}
        />
        <TextInput
          label="Effective date"
          type="date"
          required
          {...form.getInputProps('effectiveDate')}
        />
        <TextInput
          label="Investment amount (PHP)"
          inputMode="decimal"
          required
          {...form.getInputProps('principal')}
        />
        <NumberInput
          label="Monthly return (%)"
          min={0.01}
          max={100}
          decimalScale={2}
          value={form.values.monthlyRateBps / 100}
          onChange={(value) =>
            form.setFieldValue(
              'monthlyRateBps',
              typeof value === 'number' ? Math.round(value * 100) : 0
            )
          }
          error={form.errors.monthlyRateBps}
        />
        <Textarea label="Notes" {...form.getInputProps('notes')} />
        <Button type="submit" loading={busy}>
          Save agreement
        </Button>
      </Stack>
    </form>
  );
}

export function ClosureForm({
  record,
  busy,
  onSave,
}: {
  record?: { date: string; name: string };
  busy: boolean;
  onSave: (data: { date: string; name: string }) => void;
}) {
  const [date, setDate] = useState(record?.date ?? getCurrentDateISO());
  const [name, setName] = useState(record?.name ?? '');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ date, name });
      }}
    >
      <Stack>
        <TextInput
          label="Date"
          type="date"
          required
          disabled={Boolean(record)}
          value={date}
          onChange={(event) => setDate(event.currentTarget.value)}
        />
        <TextInput
          label="Bank closure name"
          required
          maxLength={255}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Button type="submit" loading={busy}>
          Save bank closure
        </Button>
      </Stack>
    </form>
  );
}

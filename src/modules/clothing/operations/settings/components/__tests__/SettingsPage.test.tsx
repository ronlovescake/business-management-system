import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { SettingsPage } from '../SettingsPage';

const mockChangeLogPage = vi.fn((_props?: unknown) => (
  <div data-testid="change-log-page" />
));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock('@mantine/dates', () => ({
  DateInput: ({
    value,
    onChange,
    'aria-label': ariaLabel,
    disabled,
  }: {
    value: Date | null;
    onChange: (value: Date | null) => void;
    'aria-label': string;
    disabled?: boolean;
  }) => (
    <input
      aria-label={ariaLabel}
      disabled={disabled}
      value={value ? value.toISOString().slice(0, 10) : ''}
      onChange={(event) => {
        onChange(
          event.currentTarget.value
            ? new Date(`${event.currentTarget.value}T00:00:00`)
            : null
        );
      }}
    />
  ),
}));

vi.mock('@/modules/clothing/operations/settings/change-log', () => ({
  ChangeLogPage: (props: unknown) => mockChangeLogPage(props),
}));

vi.mock('../AccountingSettingsTab', () => ({
  AccountingSettingsTab: () => <div>Accounting</div>,
}));

vi.mock('../InvoiceSettingsTab', () => ({
  InvoiceSettingsTab: () => <div>Invoice</div>,
}));

vi.mock('../InvoiceMessageTab', () => ({
  __esModule: true,
  default: () => <div>Messages</div>,
}));

vi.mock('../TransactionsSettingsTab', () => ({
  TransactionsSettingsTab: () => <div>Transactions</div>,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes search and date filters into the embedded change-log page', () => {
    render(
      <MantineProvider>
        <SettingsPage />
      </MantineProvider>
    );

    fireEvent.change(screen.getByLabelText('Search change log'), {
      target: { value: 'INV-2201' },
    });
    fireEvent.change(screen.getByLabelText('Filter start date'), {
      target: { value: '2026-04-04' },
    });
    fireEvent.change(screen.getByLabelText('Filter end date'), {
      target: { value: '2026-04-05' },
    });

    const lastCall = mockChangeLogPage.mock.calls.at(-1);

    expect(lastCall).toBeDefined();

    const latestProps = lastCall?.[0] as unknown as {
      externalSearch?: string;
      externalStartDate?: Date | null;
      externalEndDate?: Date | null;
    };

    expect(latestProps.externalSearch).toBe('INV-2201');
    expect(latestProps.externalStartDate).toEqual(
      new Date('2026-04-04T00:00:00')
    );
    expect(latestProps.externalEndDate).toEqual(
      new Date('2026-04-05T00:00:00')
    );
  });
});
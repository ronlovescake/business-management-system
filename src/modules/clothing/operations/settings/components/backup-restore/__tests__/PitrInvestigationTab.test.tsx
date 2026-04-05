import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { PitrInvestigationTab } from '../PitrInvestigationTab';

vi.mock('@mantine/dates', () => ({
  DateTimePicker: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | null;
    onChange: (value: Date | null) => void;
  }) => (
    <input
      aria-label={label}
      value={value ? value.toISOString() : ''}
      onChange={(event) => {
        onChange(
          event.currentTarget.value
            ? new Date(event.currentTarget.value)
            : null
        );
      }}
    />
  ),
}));

function renderTab(
  props: Partial<React.ComponentProps<typeof PitrInvestigationTab>> = {}
) {
  const defaultProps: React.ComponentProps<typeof PitrInvestigationTab> = {
    opened: true,
    baseBackups: [
      {
        folder: 'base-2026-04-04',
        timestamp: '2026-04-04T11:00:00.000Z',
        createdAt: '2026-04-04T11:00:00.000Z',
        database: 'business_management',
        host: 'db',
        port: '5432',
        label: 'scheduled backup',
        totalSize: 1024,
        files: [],
      },
    ],
    onApplyRestoreAnchor: vi.fn(),
  };

  return render(
    <MantineProvider>
      <PitrInvestigationTab {...defaultProps} {...props} />
    </MantineProvider>
  );
}

describe('PitrInvestigationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits actor and business identifier filters and anchors restore planning', async () => {
    const onApplyRestoreAnchor = vi.fn();
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/backup/pitr/audit')) {
        return {
          ok: true,
          json: async () => ({ success: true, logs: [] }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          logs: [
            {
              id: 'log-1',
              createdAt: '2026-04-04T12:00:00.000Z',
              userId: 'user-1',
              userName: 'Ron',
              entityType: 'Transaction',
              entityId: 'txn-1',
              action: 'delete',
              field: null,
              oldValue: { invoiceNumber: 'INV-1001' },
              newValue: null,
              source: 'transactions',
              metadata: { customerName: 'Acme Stores', invoiceNumber: 'INV-1001' },
            },
          ],
          filters: {
            entityTypes: ['Transaction'],
            actions: ['delete'],
            sources: ['transactions'],
          },
        }),
      };
    });

    global.fetch = fetchMock as typeof fetch;

    renderTab({ onApplyRestoreAnchor });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Actor'), {
      target: { value: 'Ron' },
    });
    fireEvent.change(screen.getByLabelText('Business identifier'), {
      target: { value: 'INV-1001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search Events' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    const filteredInvestigateRequest = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find(
        (url) =>
          url.includes('/api/backup/pitr/investigate?') &&
          url.includes('actor=Ron') &&
          url.includes('search=INV-1001')
      );

    expect(filteredInvestigateRequest).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Use' }));

    expect(onApplyRestoreAnchor).toHaveBeenCalledWith({
      folder: 'base-2026-04-04',
      targetTime: new Date('2026-04-04T11:59:59.000Z'),
      message: expect.stringContaining('delete Transaction (txn-1)'),
    });
  });

  it('shows field-level changes for the selected event', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/backup/pitr/audit')) {
        return {
          ok: true,
          json: async () => ({ success: true, logs: [] }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          logs: [
            {
              id: 'log-2',
              createdAt: '2026-04-04T12:00:00.000Z',
              userId: 'user-1',
              userName: 'Ron',
              entityType: 'transaction',
              entityId: '2417',
              action: 'update',
              field: null,
              oldValue: { quantity: 100, customers: 'John' },
              newValue: { quantity: 1000, customers: 'Mary' },
              source: 'transactions:update',
              metadata: null,
            },
          ],
          filters: {
            entityTypes: ['transaction'],
            actions: ['update'],
            sources: ['transactions:update'],
          },
        }),
      };
    });

    global.fetch = fetchMock as typeof fetch;

    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Changed Fields')).toBeInTheDocument();
    });

    expect(screen.getByText('quantity')).toBeInTheDocument();
    expect(screen.getByText('customers')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy old' }).length).toBeGreaterThan(0);
  });

  it('falls back to audit-log field changes when the change log is coarse', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/backup/pitr/audit')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            logs: [
              {
                id: 'audit-1',
                model: 'Transaction',
                action: 'update',
                targetId: '2417',
                before: { quantity: 100, customers: 'John' },
                after: { quantity: 1000, customers: 'Mary' },
                timestamp: '2026-04-04T12:00:00.500Z',
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          logs: [
            {
              id: 'log-3',
              createdAt: '2026-04-04T12:00:00.000Z',
              userId: 'user-1',
              userName: 'Ron',
              entityType: 'transaction',
              entityId: '2417',
              action: 'update',
              field: null,
              oldValue: null,
              newValue: null,
              source: 'transactions:update',
              metadata: { changed: true },
            },
          ],
          filters: {
            entityTypes: ['transaction'],
            actions: ['update'],
            sources: ['transactions:update'],
          },
        }),
      };
    });

    global.fetch = fetchMock as typeof fetch;

    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Audit log fallback')).toBeInTheDocument();
    });

    expect(screen.getByText('quantity')).toBeInTheDocument();
    expect(screen.getByText('customers')).toBeInTheDocument();
    expect(screen.getByText('Audit log match')).toBeInTheDocument();
  });
});
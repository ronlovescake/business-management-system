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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const secondRequestUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondRequestUrl).toContain('actor=Ron');
    expect(secondRequestUrl).toContain('search=INV-1001');

    fireEvent.click(screen.getByRole('button', { name: 'Use' }));

    expect(onApplyRestoreAnchor).toHaveBeenCalledWith({
      folder: 'base-2026-04-04',
      targetTime: new Date('2026-04-04T11:59:59.000Z'),
      message: expect.stringContaining('delete Transaction (txn-1)'),
    });
  });
});
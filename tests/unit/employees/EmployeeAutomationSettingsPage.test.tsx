import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { EmployeeAutomationSettingsPage } from '@/app/employees/_shared/EmployeeAutomationSettingsPage';

type TestView = {
  container: HTMLElement;
  findByText: (...args: unknown[]) => Promise<HTMLElement>;
  getByText: (...args: unknown[]) => HTMLElement;
  getByRole: (...args: unknown[]) => HTMLElement;
  findAllByRole: (...args: unknown[]) => Promise<HTMLElement[]>;
};

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));

vi.mock('@mantine/dates', async () => {
  const actual =
    await vi.importActual<typeof import('@mantine/dates')>('@mantine/dates');

  return {
    ...actual,
    DatePickerInput: ({
      label,
      value,
      onChange,
    }: {
      label: string;
      value: Date | null;
      onChange: (nextValue: Date | null) => void;
    }) => (
      <input
        aria-label={label}
        value={value ? value.toISOString().slice(0, 10) : ''}
        onChange={(event) => {
          const nextValue = event.currentTarget.value
            ? new Date(`${event.currentTarget.value}T00:00:00.000Z`)
            : null;
          onChange(nextValue);
        }}
      />
    ),
  };
});

function renderPage(): TestView {
  return render(
    <MantineProvider>
      <EmployeeAutomationSettingsPage embedded />
    </MantineProvider>
  ) as unknown as TestView;
}

describe('EmployeeAutomationSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders fetched settings and automation history', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        settings: {
          stayInAutoPresenceEnabled: true,
          stayInAutoPresenceTime: '02:00',
          stayInAutoPresenceTimezone: 'Asia/Manila',
          stayInAutoPresenceGraceMinutes: 5,
          payrollAutoGenerationEnabled: true,
          payrollAutoGenerationTime: '03:00',
          payrollAutoGenerationTimezone: 'Asia/Manila',
          payrollAutoGenerationCutoffDays: [15, 31],
        },
        history: [
          {
            id: 'run-1',
            createdAt: '2026-04-06T05:00:00.000Z',
            automationType: 'payroll-generation',
            triggerSource: 'manual',
            status: 'success',
            payrollPeriodStart: '2026-04-01',
            payrollPeriodEnd: '2026-04-15',
            periodKey: '2026-04-01:2026-04-15',
            message: 'Payroll automation completed.',
            processed: 4,
            inserted: 4,
            skipped: 0,
            triggeredByUserName: 'Admin User',
          },
        ],
      }),
    } as Response);

    const view = renderPage();

    await view.findByText(/Payroll automation completed\./);
    expect(view.getByText(/Saved monthly cutoff dates:/)).toHaveTextContent(
      '15th, End of month'
    );
    expect(view.getByText('Admin User')).toBeInTheDocument();
  });

  it('submits only changed fields on save', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: {
            stayInAutoPresenceEnabled: true,
            stayInAutoPresenceTime: '02:00',
            stayInAutoPresenceTimezone: 'Asia/Manila',
            stayInAutoPresenceGraceMinutes: 0,
            payrollAutoGenerationEnabled: false,
            payrollAutoGenerationTime: '02:00',
            payrollAutoGenerationTimezone: 'Asia/Manila',
            payrollAutoGenerationCutoffDays: [],
          },
          history: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stayInAutoPresenceEnabled: true,
          stayInAutoPresenceTime: '03:30',
          stayInAutoPresenceTimezone: 'Asia/Manila',
          stayInAutoPresenceGraceMinutes: 0,
          payrollAutoGenerationEnabled: false,
          payrollAutoGenerationTime: '02:00',
          payrollAutoGenerationTimezone: 'Asia/Manila',
          payrollAutoGenerationCutoffDays: [],
        }),
      } as Response);

    const view = renderPage();

    await waitFor(() => {
      expect(view.container.querySelector('input[type="time"]')).not.toBeNull();
    });

    const timeInput = view.container.querySelector(
      'input[type="time"]'
    ) as HTMLInputElement | null;
    const saveButton = view.getByRole('button', {
      name: 'Save changes',
    }) as HTMLButtonElement;

    if (!timeInput) {
      throw new Error('Expected automation time input to be rendered.');
    }

    await act(async () => {
      fireEvent.change(timeInput, { target: { value: '03:30' } });
    });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    await act(async () => {
      saveButton.click();
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/employee-automation-settings',
      expect.objectContaining({
        method: 'PUT',
      })
    );

    const requestInit = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      stayInAutoPresenceTime: '03:30',
    });
  });

  it('runs automation and refreshes the overview', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: {
            stayInAutoPresenceEnabled: true,
            stayInAutoPresenceTime: '02:00',
            stayInAutoPresenceTimezone: 'Asia/Manila',
            stayInAutoPresenceGraceMinutes: 0,
            payrollAutoGenerationEnabled: false,
            payrollAutoGenerationTime: '02:00',
            payrollAutoGenerationTimezone: 'Asia/Manila',
            payrollAutoGenerationCutoffDays: [],
          },
          history: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { message: 'Stay-in automation completed.' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: {
            stayInAutoPresenceEnabled: true,
            stayInAutoPresenceTime: '02:00',
            stayInAutoPresenceTimezone: 'Asia/Manila',
            stayInAutoPresenceGraceMinutes: 0,
            payrollAutoGenerationEnabled: false,
            payrollAutoGenerationTime: '02:00',
            payrollAutoGenerationTimezone: 'Asia/Manila',
            payrollAutoGenerationCutoffDays: [],
          },
          history: [
            {
              id: 'run-2',
              createdAt: '2026-04-06T06:00:00.000Z',
              automationType: 'stay-in-attendance',
              triggerSource: 'manual',
              status: 'success',
              targetDate: '2026-04-06',
              message: 'Stay-in automation completed.',
              processed: 3,
              inserted: 2,
              skipped: 1,
              triggeredByUserName: 'Admin User',
            },
          ],
        }),
      } as Response);

    const view = renderPage();

    const runButtons = await view.findAllByRole('button', { name: 'Run now' });
    runButtons[0]?.click();

    await view.findByText('Stay-in automation completed.');
    await waitFor(() => {
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        '/api/employee-automation-settings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ automationType: 'stay-in-attendance' }),
        })
      );
    });
  });
});

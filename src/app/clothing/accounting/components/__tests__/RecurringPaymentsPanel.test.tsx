import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { fireEvent, screen, within } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import type * as UniversalModalModule from '@/components/modals/UniversalModal';
import {
  RecurringPaymentsPanel,
  type RecurringPaymentDraftDTO,
  type RecurringPaymentService,
  type RecurringPaymentTemplateDTO,
} from '../RecurringPaymentsPanel';

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
  notifications: { show: vi.fn() },
}));

vi.mock('@/components/modals/UniversalModal', async (importOriginal) => {
  const actual = await importOriginal<typeof UniversalModalModule>();
  return {
    ...actual,
    UniversalModal: ({
      opened,
      title,
      children,
    }: {
      opened: boolean;
      title?: React.ReactNode;
      children: React.ReactNode;
    }) =>
      opened ? (
        <div role="dialog">
          {title}
          {children}
        </div>
      ) : null,
  };
});

const buildTemplate = (
  overrides: Partial<RecurringPaymentTemplateDTO>
): RecurringPaymentTemplateDTO => ({
  id: 'tpl',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  name: 'Template',
  kind: 'EXPENSE',
  amount: 100,
  frequency: 'MONTHLY',
  dayOfMonth: 1,
  nextDueDate: '2026-11-01T00:00:00.000Z',
  endDate: null,
  debitAccount: 'Monthly Dues Expense',
  debitTag: null,
  creditAccount: 'Cash',
  creditTag: null,
  notes: null,
  isActive: true,
  ...overrides,
});

const templates = [
  buildTemplate({
    id: 'old',
    name: 'Spotify',
    amount: 169,
    isActive: false,
    // Before the saved cutover: an unchanged date must not be resent.
    nextDueDate: '2026-02-28T00:00:00.000Z',
  }),
  buildTemplate({
    id: 'rcbc',
    name: 'RCBC Credit',
    amount: 6000,
    dayOfMonth: 19,
    nextDueDate: '2026-11-19T00:00:00.000Z',
    endDate: '2028-01-19T00:00:00.000Z',
  }),
  buildTemplate({
    id: 'ggives',
    name: 'GGives',
    amount: 664.7,
    dayOfMonth: 13,
    nextDueDate: '2026-11-13T00:00:00.000Z',
  }),
];

const draft: RecurringPaymentDraftDTO = {
  id: 'draft-1',
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
  templateId: 'ggives',
  dueDate: '2026-10-29T00:00:00.000Z',
  amount: 5666.67,
  debitAccount: 'Monthly Dues Expense',
  debitTag: null,
  creditAccount: 'Cash',
  creditTag: null,
  ref: 'RECURRING:Esquire 2',
  description: null,
  status: 'DRAFT',
  approvedAt: null,
  template: buildTemplate({ id: 'esq', name: 'Esquire 2 - 29th' }),
};

const createService = (drafts: RecurringPaymentDraftDTO[] = []) => {
  const service = {
    getTemplates: vi.fn(async () => templates),
    createTemplate: vi.fn(async () => templates[0]),
    updateTemplate: vi.fn(async () => templates[0]),
    deleteTemplateById: vi.fn(),
    generate: vi.fn(),
    getDrafts: vi.fn(async () => drafts),
    approveDraft: vi.fn(async () => ({
      draftId: 'draft-1',
      journalSourceId: 'draft-1',
    })),
    skipDraft: vi.fn(async () => ({ draftId: 'draft-1' })),
  };
  return service as typeof service & RecurringPaymentService;
};

function Harness(props: {
  service: RecurringPaymentService;
  searchQuery?: string;
}) {
  const [opened, setOpened] = React.useState(false);
  return (
    <MantineProvider>
      <button type="button" onClick={() => setOpened(true)}>
        Add Recurring Payment
      </button>
      <RecurringPaymentsPanel
        service={props.service}
        searchQuery={props.searchQuery ?? ''}
        opened={opened}
        setOpened={setOpened}
      />
    </MantineProvider>
  );
}

const rowNames = () =>
  screen
    .getAllByText(/^(Spotify|RCBC Credit|GGives)$/)
    .map((node) => node.textContent);

describe('Clothing RecurringPaymentsPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Personal-style columns with active payments first', async () => {
    render(<Harness service={createService()} />);

    await screen.findByText('GGives');
    for (const header of [
      'NAME',
      'AMOUNT',
      'KIND',
      'ACCOUNTS',
      'NEXT DUE',
      'PAYMENTS LEFT',
      'STATUS',
      'ACTIONS',
    ]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
    expect(rowNames()).toEqual(['GGives', 'RCBC Credit', 'Spotify']);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('filters rows by the header search query', async () => {
    render(<Harness service={createService()} searchQuery="rcbc" />);
    await screen.findByText('RCBC Credit');
    expect(rowNames()).toEqual(['RCBC Credit']);
  });

  it('opens a prefilled edit modal on row double-click and sends only changed fields', async () => {
    const service = createService();
    render(<Harness service={service} />);

    fireEvent.doubleClick(await screen.findByText('Spotify'));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Edit Recurring Payment')
    ).toBeInTheDocument();
    const nameInput = within(dialog).getByRole('textbox', { name: /Name/ });
    expect(nameInput).toHaveValue('Spotify');

    fireEvent.change(nameInput, { target: { value: '  Spotify Family  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    await waitFor(() =>
      expect(service.updateTemplate).toHaveBeenCalledWith('old', {
        name: 'Spotify Family',
      })
    );
  });

  it('pauses and resumes from the row action', async () => {
    const service = createService();
    render(<Harness service={service} />);
    await screen.findByText('GGives');

    const ggivesRow = screen.getByText('GGives').closest('tr') as HTMLElement;
    fireEvent.click(within(ggivesRow).getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(service.updateTemplate).toHaveBeenCalledWith('ggives', {
        isActive: false,
      })
    );

    const spotifyRow = screen.getByText('Spotify').closest('tr') as HTMLElement;
    expect(
      within(spotifyRow).getByRole('button', { name: 'Resume' })
    ).toBeInTheDocument();
  });

  it('validates the add form before creating', async () => {
    const service = createService();
    render(<Harness service={service} />);
    await screen.findByText('GGives');

    fireEvent.click(
      screen.getByRole('button', { name: 'Add Recurring Payment' })
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Add Recurring Payment')
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByText('Name is required.')).toBeInTheDocument();
    expect(service.createTemplate).not.toHaveBeenCalled();
  });

  it('lists due drafts and approves them for ledger posting', async () => {
    const service = createService([draft]);
    render(<Harness service={service} />);

    expect(
      await screen.findByText('Drafts awaiting approval (1)')
    ).toBeInTheDocument();
    const draftRow = screen
      .getByText('Esquire 2 - 29th')
      .closest('tr') as HTMLElement;
    fireEvent.click(within(draftRow).getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(service.approveDraft).toHaveBeenCalledWith('draft-1')
    );
  });
});

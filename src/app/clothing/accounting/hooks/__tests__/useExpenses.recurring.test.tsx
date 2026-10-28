import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { RECURRING_EXPENSE_CATEGORY, useExpenses } from '../useExpenses';
import { ExpenseListTable } from '../../components/ExpenseListTable';
import type {
  RecurringPaymentDraftDTO,
  RecurringPaymentService,
  RecurringPaymentTemplateDTO,
} from '../../components/RecurringPaymentsPanel';
import type { useExpenseData } from '@/hooks/useSheetData';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
  notifications: { show: vi.fn() },
}));

const showConfirm = vi.fn(async () => true);
vi.mock('@/lib/alerts', () => ({
  showConfirm: () => showConfirm(),
  showError: vi.fn(),
  showDeleteConfirm: vi.fn(async () => true),
}));

const template = {
  id: 'tpl',
  name: 'Template',
} as RecurringPaymentTemplateDTO;

const buildDraft = (
  overrides: Partial<RecurringPaymentDraftDTO>
): RecurringPaymentDraftDTO => ({
  id: 'draft',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  templateId: 'tpl',
  dueDate: '2026-10-01T00:00:00.000Z',
  amount: 100,
  debitAccount: 'Monthly Dues Expense',
  debitTag: null,
  creditAccount: 'Cash',
  creditTag: null,
  ref: 'RECURRING:Template',
  description: null,
  status: 'DRAFT',
  approvedAt: null,
  template,
  ...overrides,
});

const pendingDraft = buildDraft({
  id: 'pending-old',
  dueDate: '2026-01-31T00:00:00.000Z',
  amount: 169,
  template: { ...template, name: 'Spotify' },
});
const approvedDraft = buildDraft({
  id: 'approved',
  status: 'APPROVED',
  dueDate: '2026-10-17T00:00:00.000Z',
  amount: 21500,
  template: { ...template, name: 'BPI Credit Card' },
});

const createService = () => {
  const service = {
    getTemplates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplateById: vi.fn(),
    generate: vi.fn(),
    getDrafts: vi.fn(async (params?: { status?: string }) =>
      params?.status === 'DRAFT' ? [pendingDraft] : [approvedDraft]
    ),
    approveDraft: vi.fn(async () => ({
      draftId: 'pending-old',
      journalSourceId: 'pending-old',
    })),
    skipDraft: vi.fn(async () => ({ draftId: 'pending-old' })),
  };
  return service as typeof service & RecurringPaymentService;
};

const manualExpenses = [
  {
    id: 1,
    date: '2026-10-20',
    amount: 500,
    description: 'Packaging tape',
    category: 'Packaging',
    notes: '',
    status: 'approved',
    sourceType: 'MANUAL',
  },
];

const expenseDataHook = (() => ({
  data: manualExpenses,
  isLoading: false,
  error: null,
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteAsync: vi.fn(),
  bulkUpdate: vi.fn(),
  bulkCreate: vi.fn(),
})) as unknown as () => ReturnType<typeof useExpenseData>;

describe('Clothing expense list recurring rows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pins drafts awaiting approval on top, then sorts by date, and counts them in totals', async () => {
    const service = createService();
    const { result } = renderHook(() =>
      useExpenses({ expenseDataHook, recurringService: service })
    );

    await waitFor(() =>
      expect(result.current.filteredExpenses).toHaveLength(3)
    );
    expect(
      result.current.filteredExpenses.map((expense) => expense.description)
    ).toEqual(['Spotify', 'Packaging tape', 'BPI Credit Card']);
    expect(service.getDrafts).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT' })
    );

    expect(result.current.pendingExpenses).toBe(1);
    expect(result.current.approvedExpenses).toBe(22000);
    expect(result.current.totalExpenses).toBe(22169);
    expect(result.current.filterCategories).toContain(
      RECURRING_EXPENSE_CATEGORY
    );
    expect(result.current.categories).not.toContain(RECURRING_EXPENSE_CATEGORY);
  });

  it('approves and skips through the recurring service, then reloads', async () => {
    const service = createService();
    const { result } = renderHook(() =>
      useExpenses({ expenseDataHook, recurringService: service })
    );
    await waitFor(() =>
      expect(result.current.filteredExpenses).toHaveLength(3)
    );

    await act(async () => {
      await result.current.handleApproveRecurring('pending-old');
    });
    expect(service.approveDraft).toHaveBeenCalledWith('pending-old');

    await act(async () => {
      await result.current.handleSkipRecurring('pending-old');
    });
    expect(showConfirm).toHaveBeenCalled();
    expect(service.skipDraft).toHaveBeenCalledWith('pending-old');
    await waitFor(() =>
      expect(service.getDrafts.mock.calls.length).toBeGreaterThanOrEqual(6)
    );
  });

  it('renders Approve/Skip for pending drafts, Posted for approved, and no edit/delete', async () => {
    const service = createService();
    const { result } = renderHook(() =>
      useExpenses({ expenseDataHook, recurringService: service })
    );
    await waitFor(() =>
      expect(result.current.filteredExpenses).toHaveLength(3)
    );

    const onApproveRecurring = vi.fn();
    const onEdit = vi.fn();
    // ExpenseListTable uses the classic JSX transform without importing React.
    vi.stubGlobal('React', React);
    render(
      <MantineProvider>
        <ExpenseListTable
          expenses={result.current.expenses}
          filteredExpenses={result.current.filteredExpenses}
          formatDate={(date) => date.slice(0, 10)}
          formatCurrency={(amount) => String(amount)}
          getCategoryColor={() => 'gray'}
          getSourceLabel={(source) => source ?? 'Manual'}
          getSourceColor={() => 'gray'}
          onViewReceipt={vi.fn()}
          onEdit={onEdit}
          onDelete={vi.fn()}
          onApproveRecurring={onApproveRecurring}
          onSkipRecurring={vi.fn()}
        />
      </MantineProvider>
    );

    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
    expect(screen.getByText('Posted')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Approve recurring payment Spotify' })
    );
    expect(onApproveRecurring).toHaveBeenCalledWith('pending-old');
    // Only the manual expense keeps Edit/Delete actions.
    expect(screen.getAllByRole('button', { name: /^Edit/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Delete/ })).toHaveLength(1);
  });
});

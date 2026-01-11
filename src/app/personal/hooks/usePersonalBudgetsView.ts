import { useCallback, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { normalizeText } from '@/utils/text';

export type BudgetPeriod = 'monthly' | 'annual';
export type BudgetStatus = 'over' | 'under' | 'on-track';

export interface BudgetRow {
  id: string;
  category: string;
  planned: number;
  actual: number;
  period: BudgetPeriod;
  month?: number; // 1-based month for monthly budgets
  account?: string;
  notes?: string;
}

export interface BudgetDisplayRow extends BudgetRow {
  variance: number;
  remaining: number;
  status: BudgetStatus;
  monthLabel: string;
}

export interface BudgetStats {
  totalPlanned: number;
  totalActual: number;
  totalRemaining: number;
  thisMonthPlanned: number;
  thisMonthActual: number;
}

export interface BudgetAnalyticsRow {
  category: string;
  planned: number;
  actual: number;
  variance: number;
  status: BudgetStatus;
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function usePersonalBudgetsView() {
  const sampleBudgets: BudgetRow[] = useMemo(
    () => [
      {
        id: 'groceries-jan',
        category: 'Groceries',
        planned: 15000,
        actual: 13250,
        period: 'monthly',
        month: new Date().getMonth() + 1,
        account: 'Household Operating',
        notes: 'Includes weekly markets and pantry restocks.',
      },
      {
        id: 'utilities-jan',
        category: 'Utilities',
        planned: 8500,
        actual: 9100,
        period: 'monthly',
        month: new Date().getMonth() + 1,
        account: 'Household Operating',
        notes: 'Power, water, internet, and mobile.',
      },
      {
        id: 'rent-annual',
        category: 'Housing',
        planned: 480000,
        actual: 480000,
        period: 'annual',
        account: 'Main Checking',
        notes: 'Annual lease prepaid in January.',
      },
      {
        id: 'subscriptions',
        category: 'Subscriptions',
        planned: 3600,
        actual: 2800,
        period: 'monthly',
        month: new Date().getMonth() + 1,
        account: 'Main Checking',
        notes: 'Streaming, cloud storage, and software.',
      },
      {
        id: 'emergency-fund',
        category: 'Emergency Fund',
        planned: 120000,
        actual: 52000,
        period: 'annual',
        account: 'Savings',
        notes: 'Target reserve for the year.',
      },
    ],
    []
  );

  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<BudgetPeriod | 'all' | null>(
    null
  );
  const [filterStatus, setFilterStatus] = useState<BudgetStatus | 'all' | null>(
    null
  );

  const displayBudgets: BudgetDisplayRow[] = useMemo(() => {
    return sampleBudgets.map((budget) => {
      const status: BudgetStatus =
        budget.actual > budget.planned
          ? 'over'
          : budget.actual < budget.planned
            ? 'under'
            : 'on-track';

      const variance = budget.actual - budget.planned;
      const remaining = budget.planned - budget.actual;
      const monthLabel =
        budget.period === 'monthly' && budget.month
          ? monthNames[Math.max(0, budget.month - 1)]
          : 'Annual';

      return {
        ...budget,
        status,
        variance,
        remaining,
        monthLabel,
      };
    });
  }, [sampleBudgets]);

  const filteredBudgets = useMemo(() => {
    const query = normalizeText(searchQuery);

    return displayBudgets.filter((budget) => {
      if (query) {
        const haystack = normalizeText(
          [
            budget.category,
            budget.account ?? '',
            budget.notes ?? '',
            budget.period,
            budget.monthLabel,
          ].join(' ')
        );
        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (filterCategory && budget.category !== filterCategory) {
        return false;
      }

      if (
        filterPeriod &&
        filterPeriod !== 'all' &&
        budget.period !== filterPeriod
      ) {
        return false;
      }

      if (
        filterStatus &&
        filterStatus !== 'all' &&
        budget.status !== filterStatus
      ) {
        return false;
      }

      return true;
    });
  }, [displayBudgets, filterCategory, filterPeriod, filterStatus, searchQuery]);

  const categories = useMemo(() => {
    const unique = new Set(displayBudgets.map((b) => b.category));
    return Array.from(unique);
  }, [displayBudgets]);

  const stats: BudgetStats = useMemo(() => {
    const totalPlanned = displayBudgets.reduce(
      (sum, budget) => sum + budget.planned,
      0
    );
    const totalActual = displayBudgets.reduce(
      (sum, budget) => sum + budget.actual,
      0
    );
    const totalRemaining = totalPlanned - totalActual;

    const currentMonth = new Date().getMonth() + 1;
    const thisMonthBudgets = displayBudgets.filter(
      (budget) => budget.period === 'monthly' && budget.month === currentMonth
    );

    const thisMonthPlanned = thisMonthBudgets.reduce(
      (sum, budget) => sum + budget.planned,
      0
    );
    const thisMonthActual = thisMonthBudgets.reduce(
      (sum, budget) => sum + budget.actual,
      0
    );

    return {
      totalPlanned,
      totalActual,
      totalRemaining,
      thisMonthPlanned,
      thisMonthActual,
    };
  }, [displayBudgets]);

  const analyticsByCategory: BudgetAnalyticsRow[] = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number }>();

    displayBudgets.forEach((budget) => {
      const existing = map.get(budget.category) ?? { planned: 0, actual: 0 };
      existing.planned += budget.planned;
      existing.actual += budget.actual;
      map.set(budget.category, existing);
    });

    return Array.from(map.entries()).map(([category, { planned, actual }]) => {
      const variance = actual - planned;
      const status: BudgetStatus =
        variance > 0 ? 'over' : variance < 0 ? 'under' : 'on-track';

      return {
        category,
        planned,
        actual,
        variance,
        status,
      };
    });
  }, [displayBudgets]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  }, []);

  const handleImportCSV = useCallback(async () => {
    await Swal.fire({
      icon: 'info',
      title: 'CSV import coming soon',
      text: 'Budget import/export will be wired to the API.',
    });
  }, []);

  const handleExportCSV = useCallback(async () => {
    await Swal.fire({
      icon: 'info',
      title: 'CSV export coming soon',
      text: 'We will export budgets once the dataset is connected.',
    });
  }, []);

  const handleAddBudget = useCallback(async () => {
    await Swal.fire({
      icon: 'info',
      title: 'Add budget',
      text: 'Budget creation modal will be added once the API is ready.',
    });
  }, []);

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    filterPeriod,
    setFilterPeriod,
    filterStatus,
    setFilterStatus,
    categories,
    displayBudgets,
    filteredBudgets,
    stats,
    analyticsByCategory,
    formatCurrency,
    handleImportCSV,
    handleExportCSV,
    handleAddBudget,
  } as const;
}

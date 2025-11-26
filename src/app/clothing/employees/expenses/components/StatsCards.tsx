import { memo, useMemo } from 'react';
import {
  IconReceipt,
  IconX,
  IconCheck,
  IconDownload,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface StatsCardsProps {
  totalExpenses: number;
  pendingExpenses: number;
  approvedExpenses: number;
  thisMonthExpenses: number;
  formatCurrency: (amount: number) => string;
}

/**
 * StatsCards Component
 *
 * Displays 4 glassmorphism-styled stat cards showing:
 * - Total Expenses
 * - Pending Approval
 * - Approved Total
 * - This Month's Expenses
 */
export const StatsCards = memo(function StatsCards({
  totalExpenses,
  pendingExpenses,
  approvedExpenses,
  thisMonthExpenses,
  formatCurrency,
}: StatsCardsProps) {
  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Total Expenses',
        value: formatCurrency(totalExpenses),
        icon: <IconReceipt size={24} stroke={1.6} />,
        color: 'blue',
        backgroundColor:
          'linear-gradient(135deg, rgba(60, 99, 255, 0.95), rgba(99, 102, 241, 0.95))',
      },
      {
        title: 'Pending Approval',
        value: pendingExpenses.toString(),
        icon: <IconX size={24} stroke={1.6} />,
        color: 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(248, 113, 113, 0.95), rgba(239, 68, 68, 0.95))',
      },
      {
        title: 'Approved Total',
        value: formatCurrency(approvedExpenses),
        icon: <IconCheck size={24} stroke={1.6} />,
        color: 'green',
        backgroundColor:
          'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
      },
      {
        title: 'This Month',
        value: formatCurrency(thisMonthExpenses),
        icon: <IconDownload size={24} stroke={1.6} />,
        color: 'teal',
        backgroundColor:
          'linear-gradient(135deg, rgba(45, 212, 191, 0.95), rgba(13, 148, 136, 0.95))',
      },
    ],
    [
      approvedExpenses,
      formatCurrency,
      pendingExpenses,
      thisMonthExpenses,
      totalExpenses,
    ]
  );

  return (
    <StatsCardGrid
      cards={cards}
      variant="vibrant"
      minCardWidth={240}
      spacing="md"
    />
  );
});

import { memo, useMemo } from 'react';
import {
  IconReceipt,
  IconList,
  IconCheck,
  IconDownload,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface IncomeStatsCardsProps {
  totalIncome: number;
  incomeCount: number;
  thisMonthIncome: number;
  last30DaysIncome: number;
  formatCurrency: (amount: number) => string;
}

export const IncomeStatsCards = memo(function IncomeStatsCards({
  totalIncome,
  incomeCount,
  thisMonthIncome,
  last30DaysIncome,
  formatCurrency,
}: IncomeStatsCardsProps) {
  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Total Income',
        value: formatCurrency(totalIncome),
        icon: <IconReceipt size={24} stroke={1.6} />,
        color: 'blue',
        backgroundColor:
          'linear-gradient(135deg, rgba(60, 99, 255, 0.95), rgba(99, 102, 241, 0.95))',
      },
      {
        title: 'Income Entries',
        value: incomeCount.toString(),
        icon: <IconList size={24} stroke={1.6} />,
        color: 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(248, 113, 113, 0.95), rgba(239, 68, 68, 0.95))',
      },
      {
        title: 'This Month',
        value: formatCurrency(thisMonthIncome),
        icon: <IconCheck size={24} stroke={1.6} />,
        color: 'green',
        backgroundColor:
          'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
      },
      {
        title: 'Last 30 Days',
        value: formatCurrency(last30DaysIncome),
        icon: <IconDownload size={24} stroke={1.6} />,
        color: 'teal',
        backgroundColor:
          'linear-gradient(135deg, rgba(45, 212, 191, 0.95), rgba(13, 148, 136, 0.95))',
      },
    ],
    [
      formatCurrency,
      incomeCount,
      last30DaysIncome,
      thisMonthIncome,
      totalIncome,
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

import { memo, useMemo } from 'react';
import {
  IconChartBar,
  IconCurrencyPeso,
  IconScale,
  IconCalendar,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface ProfitLossStatsCardsProps {
  revenueTotal: number;
  expenseTotal: number;
  netProfit: number;
  period: string;
  formatCurrency: (amount: number) => string;
}

export const ProfitLossStatsCards = memo(function ProfitLossStatsCards({
  revenueTotal,
  expenseTotal,
  netProfit,
  period,
  formatCurrency,
}: ProfitLossStatsCardsProps) {
  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Revenue',
        value: formatCurrency(revenueTotal),
        icon: <IconChartBar size={24} stroke={1.6} />,
        color: 'blue',
        backgroundColor:
          'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))',
      },
      {
        title: 'Expenses',
        value: formatCurrency(expenseTotal),
        icon: <IconCurrencyPeso size={24} stroke={1.6} />,
        color: 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(248, 113, 113, 0.95), rgba(239, 68, 68, 0.95))',
      },
      {
        title: 'Net Profit',
        value: formatCurrency(netProfit),
        icon: <IconScale size={24} stroke={1.6} />,
        color: netProfit >= 0 ? 'green' : 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))',
      },
      {
        title: 'Period',
        value: period,
        icon: <IconCalendar size={24} stroke={1.6} />,
        color: 'violet',
        backgroundColor:
          'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(109, 40, 217, 0.95))',
      },
    ],
    [expenseTotal, formatCurrency, netProfit, period, revenueTotal]
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

import { memo, useMemo } from 'react';
import {
  IconCurrencyPeso,
  IconGasStation,
  IconChartLine,
  IconRoute,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface TripsStatsCardsProps {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  tripsThisMonth: number;
  formatCurrency: (amount: number) => string;
}

export const TripsStatsCards = memo(function TripsStatsCards({
  totalRevenue,
  totalExpenses,
  netIncome,
  tripsThisMonth,
  formatCurrency,
}: TripsStatsCardsProps) {
  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Total Revenue',
        value: formatCurrency(totalRevenue),
        icon: <IconCurrencyPeso size={24} stroke={1.6} />,
        color: 'indigo',
        backgroundColor:
          'linear-gradient(135deg, rgba(79,70,229,0.95), rgba(99,102,241,0.95))',
      },
      {
        title: 'Total Expenses',
        value: formatCurrency(totalExpenses),
        icon: <IconGasStation size={24} stroke={1.6} />,
        color: 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(248,113,113,0.95))',
      },
      {
        title: 'Net Margin',
        value: formatCurrency(netIncome),
        icon: <IconChartLine size={24} stroke={1.6} />,
        color: netIncome >= 0 ? 'green' : 'orange',
        backgroundColor:
          netIncome >= 0
            ? 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.95))'
            : 'linear-gradient(135deg, rgba(249,115,22,0.95), rgba(234,88,12,0.95))',
      },
      {
        title: 'Trips This Month',
        value: tripsThisMonth.toString(),
        icon: <IconRoute size={24} stroke={1.6} />,
        color: 'teal',
        backgroundColor:
          'linear-gradient(135deg, rgba(13,148,136,0.95), rgba(20,184,166,0.95))',
      },
    ],
    [formatCurrency, netIncome, totalExpenses, totalRevenue, tripsThisMonth]
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

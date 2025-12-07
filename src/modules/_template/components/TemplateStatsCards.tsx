import { memo, useMemo } from 'react';
import {
  IconChartLine,
  IconCurrencyPeso,
  IconReportMoney,
  IconCalendarStats,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface TemplateStatsCardsProps {
  totalIn: number;
  totalOut: number;
  net: number;
  recordsThisMonth: number;
  formatCurrency: (value: number) => string;
}

export const TemplateStatsCards = memo(function TemplateStatsCards({
  totalIn,
  totalOut,
  net,
  recordsThisMonth,
  formatCurrency,
}: TemplateStatsCardsProps) {
  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Total In',
        value: formatCurrency(totalIn),
        icon: <IconCurrencyPeso size={24} stroke={1.6} />,
        color: 'indigo',
        backgroundColor:
          'linear-gradient(135deg, rgba(79,70,229,0.95), rgba(99,102,241,0.95))',
      },
      {
        title: 'Total Out',
        value: formatCurrency(totalOut),
        icon: <IconReportMoney size={24} stroke={1.6} />,
        color: 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(248,113,113,0.95))',
      },
      {
        title: 'Net',
        value: formatCurrency(net),
        icon: <IconChartLine size={24} stroke={1.6} />,
        color: net >= 0 ? 'green' : 'orange',
        backgroundColor:
          net >= 0
            ? 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.95))'
            : 'linear-gradient(135deg, rgba(249,115,22,0.95), rgba(234,88,12,0.95))',
      },
      {
        title: 'Records This Month',
        value: recordsThisMonth.toString(),
        icon: <IconCalendarStats size={24} stroke={1.6} />,
        color: 'teal',
        backgroundColor:
          'linear-gradient(135deg, rgba(13,148,136,0.95), rgba(20,184,166,0.95))',
      },
    ],
    [formatCurrency, net, recordsThisMonth, totalIn, totalOut]
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

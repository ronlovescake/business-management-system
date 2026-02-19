import { memo } from 'react';
import {
  IconCurrencyPeso,
  IconReceipt,
  IconTrendingUp,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';
import type { InventoryTotals } from '../types';
import { currencyFormatter } from '../lib/formatters';

interface InventorySummaryProps {
  filteredCount: number;
  totalCount: number;
  totals: InventoryTotals;
}

export const InventorySummary = memo(({ totals }: InventorySummaryProps) => {
  const statsCards: StatCard[] = [
    {
      title: 'GROSS REVENUE',
      value: currencyFormatter.format(totals.totalSales),
      icon: <IconTrendingUp size={20} stroke={1.6} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'COGS',
      value: currencyFormatter.format(totals.cogs),
      icon: <IconReceipt size={20} stroke={1.6} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
    },
    {
      title: 'GROSS PROFIT',
      value: currencyFormatter.format(totals.netProfit),
      icon: <IconTrendingUp size={20} stroke={1.6} />,
      color: 'orange',
      backgroundColor: '#fd7e14',
    },
    {
      title: 'SELLABLE VALUE',
      value: currencyFormatter.format(totals.endingInventoryValue),
      icon: <IconCurrencyPeso size={20} stroke={1.6} />,
      color: 'grape',
      backgroundColor: '#9775fa',
    },
  ];

  return (
    <StatsCardGrid
      cards={statsCards}
      variant="vibrant"
      minCardWidth={220}
      spacing="md"
    />
  );
});

InventorySummary.displayName = 'InventorySummary';

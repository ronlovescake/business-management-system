'use client';

import React, { useMemo } from 'react';
import { StatsCardGrid } from '@/components/ui/StatsCardGrid';
import type { StatCard } from '@/components/ui';
import type { TransactionStatistics } from '../types/transaction.types';
import {
  IconReceipt,
  IconCurrencyPeso,
  IconPackage,
  IconShoppingCart,
  IconAdjustments,
  IconPercentage,
  IconCheck,
  IconUsers,
} from '@tabler/icons-react';

interface TransactionsStatsSectionProps {
  statistics: TransactionStatistics;
}

const formatCurrency = (value: number): string => `₱${value.toLocaleString()}`;

type CardDefinition = {
  title: string;
  key: keyof TransactionStatistics;
  formatter: (value: number) => string | number;
  icon: React.ReactNode;
  color: string;
  backgroundColor: string;
};

const cardDefinitions: CardDefinition[] = [
  {
    title: 'CUSTOMERS',
    key: 'uniqueCustomers',
    formatter: (value) => value,
    icon: <IconUsers size={18} />,
    color: 'blue',
    backgroundColor: 'var(--mantine-color-blue-6)',
  },
  {
    title: 'Total Transactions',
    key: 'totalTransactions',
    formatter: (value) => value,
    icon: <IconReceipt size={18} />,
    color: 'green',
    backgroundColor: 'var(--mantine-color-green-6)',
  },
  {
    title: 'Total Quantity',
    key: 'totalQuantity',
    formatter: (value) => value.toLocaleString(),
    icon: <IconPackage size={18} />,
    color: 'green',
    backgroundColor: 'var(--mantine-color-green-6)',
  },
  {
    title: 'Total Revenue',
    key: 'totalRevenue',
    formatter: formatCurrency,
    icon: <IconCurrencyPeso size={18} />,
    color: 'orange',
    backgroundColor: '#fd7e14',
  },
  {
    title: 'In Transit',
    key: 'inTransitTotal',
    formatter: formatCurrency,
    icon: <IconPackage size={18} />,
    color: 'purple',
    backgroundColor: '#9775fa',
  },
  {
    title: 'Warehouse',
    key: 'warehouseTotal',
    formatter: formatCurrency,
    icon: <IconShoppingCart size={18} />,
    color: 'blue',
    backgroundColor: 'var(--mantine-color-blue-6)',
  },
  {
    title: 'Prepared',
    key: 'preparedTotal',
    formatter: formatCurrency,
    icon: <IconPercentage size={18} />,
    color: 'green',
    backgroundColor: 'var(--mantine-color-green-6)',
  },
  {
    title: 'Pending Payment',
    key: 'pendingPaymentTotal',
    formatter: formatCurrency,
    icon: <IconAdjustments size={18} />,
    color: 'orange',
    backgroundColor: '#fd7e14',
  },
  {
    title: 'Adjustment',
    key: 'adjustmentTotal',
    formatter: formatCurrency,
    icon: <IconAdjustments size={18} />,
    color: 'purple',
    backgroundColor: '#9775fa',
  },
  {
    title: 'Line Total',
    key: 'lineTotalExcludingCancelled',
    formatter: formatCurrency,
    icon: <IconCheck size={18} />,
    color: 'blue',
    backgroundColor: 'var(--mantine-color-blue-6)',
  },
];

export function TransactionsStatsSection({
  statistics,
}: TransactionsStatsSectionProps) {
  const cards = useMemo<StatCard[]>(() => {
    return cardDefinitions.map((definition) => {
      const rawValue = statistics[definition.key];
      const formatted = definition.formatter(rawValue);
      return {
        title: definition.title,
        value: formatted,
        icon: definition.icon,
        color: definition.color,
        backgroundColor: definition.backgroundColor,
      } satisfies StatCard;
    });
  }, [statistics]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <StatsCardGrid
      cards={cards}
      variant="vibrant"
      minCardWidth={220}
      spacing="md"
    />
  );
}

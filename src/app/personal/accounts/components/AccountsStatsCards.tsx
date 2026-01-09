import { memo, useMemo } from 'react';
import {
  IconWallet,
  IconX,
  IconCheck,
  IconDownload,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface AccountsStatsCardsProps {
  totalAccounts: number;
  activeAccounts: number;
  totalBalance: number;
  thisMonthChange: number;
  formatCurrency: (amount: number) => string;
}

export const AccountsStatsCards = memo(function AccountsStatsCards({
  totalAccounts,
  activeAccounts,
  totalBalance,
  thisMonthChange,
  formatCurrency,
}: AccountsStatsCardsProps) {
  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Total Accounts',
        value: totalAccounts.toString(),
        icon: <IconWallet size={24} stroke={1.6} />,
        color: 'blue',
        backgroundColor:
          'linear-gradient(135deg, rgba(60, 99, 255, 0.95), rgba(99, 102, 241, 0.95))',
      },
      {
        title: 'Active Accounts',
        value: activeAccounts.toString(),
        icon: <IconX size={24} stroke={1.6} />,
        color: 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(248, 113, 113, 0.95), rgba(239, 68, 68, 0.95))',
      },
      {
        title: 'Total Balance',
        value: formatCurrency(totalBalance),
        icon: <IconCheck size={24} stroke={1.6} />,
        color: 'green',
        backgroundColor:
          'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
      },
      {
        title: 'This Month',
        value: formatCurrency(thisMonthChange),
        icon: <IconDownload size={24} stroke={1.6} />,
        color: 'teal',
        backgroundColor:
          'linear-gradient(135deg, rgba(45, 212, 191, 0.95), rgba(13, 148, 136, 0.95))',
      },
    ],
    [
      activeAccounts,
      formatCurrency,
      thisMonthChange,
      totalAccounts,
      totalBalance,
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

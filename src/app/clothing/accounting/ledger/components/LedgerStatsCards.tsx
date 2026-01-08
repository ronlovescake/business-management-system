import { memo, useMemo } from 'react';
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconScale,
  IconBookmarks,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface LedgerStatsCardsProps {
  totalDebits: number;
  totalCredits: number;
  netChange: number;
  accounts: number;
  formatCurrency: (amount: number) => string;
}

export const LedgerStatsCards = memo(function LedgerStatsCards({
  totalDebits,
  totalCredits,
  netChange,
  accounts,
  formatCurrency,
}: LedgerStatsCardsProps) {
  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Total Debits',
        value: formatCurrency(totalDebits),
        icon: <IconArrowUpRight size={24} stroke={1.6} />,
        color: 'blue',
        backgroundColor:
          'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))',
      },
      {
        title: 'Total Credits',
        value: formatCurrency(totalCredits),
        icon: <IconArrowDownRight size={24} stroke={1.6} />,
        color: 'teal',
        backgroundColor:
          'linear-gradient(135deg, rgba(45, 212, 191, 0.95), rgba(13, 148, 136, 0.95))',
      },
      {
        title: 'Net Change',
        value: formatCurrency(netChange),
        icon: <IconScale size={24} stroke={1.6} />,
        color: netChange >= 0 ? 'green' : 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))',
      },
      {
        title: 'Accounts',
        value: accounts.toString(),
        icon: <IconBookmarks size={24} stroke={1.6} />,
        color: 'violet',
        backgroundColor:
          'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(109, 40, 217, 0.95))',
      },
    ],
    [accounts, formatCurrency, netChange, totalCredits, totalDebits]
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

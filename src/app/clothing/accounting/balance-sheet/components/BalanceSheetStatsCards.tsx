import { memo, useMemo } from 'react';
import {
  IconWallet,
  IconBuildingBank,
  IconScale,
  IconCalendar,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface BalanceSheetStatsCardsProps {
  assets: number;
  liabilities: number;
  equity: number;
  balance: number;
  asOf: string;
  formatCurrency: (amount: number) => string;
}

export const BalanceSheetStatsCards = memo(function BalanceSheetStatsCards({
  assets,
  liabilities,
  equity,
  balance,
  asOf,
  formatCurrency,
}: BalanceSheetStatsCardsProps) {
  const liabilitiesDisplay = -liabilities;
  const equityDisplay = -equity;

  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Assets',
        value: formatCurrency(assets),
        icon: <IconWallet size={24} stroke={1.6} />,
        color: 'blue',
        backgroundColor:
          'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))',
      },
      {
        title: 'Liabilities',
        value: formatCurrency(liabilitiesDisplay),
        icon: <IconBuildingBank size={24} stroke={1.6} />,
        color: 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(248, 113, 113, 0.95), rgba(239, 68, 68, 0.95))',
      },
      {
        title: 'Equity',
        value: formatCurrency(equityDisplay),
        icon: <IconScale size={24} stroke={1.6} />,
        color: 'green',
        backgroundColor:
          'linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))',
      },
      {
        title: 'Balance',
        value: formatCurrency(balance),
        icon: <IconScale size={24} stroke={1.6} />,
        color: balance === 0 ? 'teal' : 'orange',
        backgroundColor:
          'linear-gradient(135deg, rgba(45, 212, 191, 0.95), rgba(13, 148, 136, 0.95))',
      },
      {
        title: 'As of',
        value: asOf,
        icon: <IconCalendar size={24} stroke={1.6} />,
        color: 'violet',
        backgroundColor:
          'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(109, 40, 217, 0.95))',
      },
    ],
    [asOf, assets, balance, equityDisplay, formatCurrency, liabilitiesDisplay]
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

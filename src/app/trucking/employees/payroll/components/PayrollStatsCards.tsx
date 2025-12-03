import { memo } from 'react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface PayrollStatsCardsProps {
  stats: StatCard[];
}

export const PayrollStatsCards = memo(function PayrollStatsCards({
  stats,
}: PayrollStatsCardsProps) {
  return (
    <StatsCardGrid
      cards={stats}
      variant="vibrant"
      minCardWidth={220}
      spacing="md"
    />
  );
});

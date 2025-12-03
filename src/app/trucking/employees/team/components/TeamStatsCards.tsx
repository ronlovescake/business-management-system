import { memo } from 'react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface TeamStatsCardsProps {
  stats: StatCard[];
}

export const TeamStatsCards = memo(function TeamStatsCards({
  stats,
}: TeamStatsCardsProps) {
  return (
    <StatsCardGrid
      cards={stats}
      variant="vibrant"
      minCardWidth={220}
      spacing="md"
    />
  );
});

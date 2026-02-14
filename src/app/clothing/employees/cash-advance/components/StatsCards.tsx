import type { CashAdvanceStats } from '../types';
import { CashAdvanceStatsCards } from '@/modules/shared/employees/cash-advance/components/CashAdvanceStatsCards';

interface StatsCardsProps {
  stats: CashAdvanceStats[];
}

export function StatsCards({ stats }: StatsCardsProps) {
  return <CashAdvanceStatsCards stats={stats} />;
}

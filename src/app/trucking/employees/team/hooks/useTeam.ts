'use client';

import { useTeam as useTeamBase } from '@/app/clothing/employees/team/hooks/useTeam';

export function useTeam() {
  return useTeamBase('/api/trucking');
}

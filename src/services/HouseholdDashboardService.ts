import { BaseService } from './BaseService';
import type { DateFilterType } from '@/lib/analytics/periodComparison';
import type { HouseholdDashboardSummary } from '@/modules/household/dashboard/api';

export class HouseholdDashboardService extends BaseService {
  protected static endpoint = '/household/dashboard';

  static async getSummary(
    range: DateFilterType
  ): Promise<HouseholdDashboardSummary> {
    return this.get<HouseholdDashboardSummary>(
      `${this.endpoint}?range=${encodeURIComponent(range)}`
    );
  }
}

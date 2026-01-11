import { BaseService } from './BaseService';

export interface HouseholdBudgetDTO {
  id: string;
  category: string;
  period: 'monthly' | 'annual';
  plannedAmount: number;
  actualAmount: number;
  month: number | null;
  year: number | null;
  accountId: string | null;
  accountName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export class HouseholdBudgetService extends BaseService {
  protected static endpoint = '/household/budgets';

  static async getAll(): Promise<HouseholdBudgetDTO[]> {
    return this.get<HouseholdBudgetDTO[]>(this.endpoint);
  }

  static async create(payload: {
    category: string;
    period: 'monthly' | 'annual';
    plannedAmount: number;
    actualAmount?: number;
    month?: number | null;
    year?: number | null;
    accountId?: string | null;
    notes?: string | null;
  }): Promise<HouseholdBudgetDTO> {
    return this.post<HouseholdBudgetDTO>(this.endpoint, payload);
  }

  static async update(
    id: string,
    payload: {
      category?: string;
      period?: 'monthly' | 'annual';
      plannedAmount?: number;
      actualAmount?: number;
      month?: number | null;
      year?: number | null;
      accountId?: string | null;
      notes?: string | null;
    }
  ): Promise<HouseholdBudgetDTO> {
    return this.patch<HouseholdBudgetDTO>(this.endpoint, { id, ...payload });
  }

  static async deleteById(id: string): Promise<HouseholdBudgetDTO> {
    return this.request<HouseholdBudgetDTO>(
      `${this.endpoint}?id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
  }
}

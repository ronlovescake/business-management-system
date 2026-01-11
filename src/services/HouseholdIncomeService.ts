import { BaseService } from './BaseService';

export interface HouseholdIncomeDTO {
  id: string;
  date: string;
  type: string;
  amount: number;
  account: string | null;
  accountId: string | null;
  notes: string | null;
}

export class HouseholdIncomeService extends BaseService {
  protected static endpoint = '/household/income';

  static async getAll(): Promise<HouseholdIncomeDTO[]> {
    return this.get<HouseholdIncomeDTO[]>(this.endpoint);
  }

  static async create(payload: {
    date: string;
    type: string;
    amount: number;
    account?: string | null;
    accountId?: string | null;
    notes?: string | null;
  }): Promise<HouseholdIncomeDTO> {
    return this.post<HouseholdIncomeDTO>(this.endpoint, payload);
  }

  static async update(
    id: string,
    payload: {
      date?: string;
      type?: string;
      amount?: number;
      account?: string | null;
      accountId?: string | null;
      notes?: string | null;
    }
  ): Promise<HouseholdIncomeDTO> {
    return this.patch<HouseholdIncomeDTO>(this.endpoint, { id, ...payload });
  }

  static async deleteById(id: string): Promise<HouseholdIncomeDTO> {
    return this.request<HouseholdIncomeDTO>(
      `${this.endpoint}?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  }
}

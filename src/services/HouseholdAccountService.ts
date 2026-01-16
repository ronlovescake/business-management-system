import { BaseService } from './BaseService';

export interface HouseholdAccountDTO {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  accountNumberLast4: string | null;
  isActive: boolean;
  balance: number;
}

export class HouseholdAccountService extends BaseService {
  protected static endpoint = '/household/accounts';

  static async getAll(): Promise<HouseholdAccountDTO[]> {
    return this.get<HouseholdAccountDTO[]>(this.endpoint);
  }

  static async create(payload: {
    name: string;
    type: string;
    institution?: string | null;
    accountNumberLast4?: string | null;
  }): Promise<HouseholdAccountDTO> {
    return this.post<HouseholdAccountDTO>(this.endpoint, payload);
  }

  static async createMany(
    payloads: Array<{
      name: string;
      type: string;
      institution?: string | null;
      accountNumberLast4?: string | null;
    }>
  ): Promise<{ count: number }> {
    return this.post<{ count: number }>(this.endpoint, payloads);
  }

  static async update(
    id: string,
    payload: {
      name?: string;
      type?: string;
      institution?: string | null;
      accountNumberLast4?: string | null;
    }
  ): Promise<HouseholdAccountDTO> {
    return this.patch<HouseholdAccountDTO>(this.endpoint, { id, ...payload });
  }

  static async deleteById(id: string): Promise<HouseholdAccountDTO> {
    return this.request<HouseholdAccountDTO>(
      `${this.endpoint}?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  }
}

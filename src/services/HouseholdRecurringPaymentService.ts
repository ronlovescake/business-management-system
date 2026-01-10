import { BaseService } from './BaseService';

export interface HouseholdRecurringPaymentDTO {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  amount: number;
  category: string;
  notes: string | null;
  startDate: string;
  monthsCount: number | null;
  isActive: boolean;
  deductOnGenerate?: boolean;
  accountId: string | null;
}

export class HouseholdRecurringPaymentService extends BaseService {
  protected static endpoint = '/household/recurring-payments';

  static async getAll(): Promise<HouseholdRecurringPaymentDTO[]> {
    return this.get<HouseholdRecurringPaymentDTO[]>(this.endpoint);
  }

  static async create(payload: {
    name: string;
    amount: number;
    category: string;
    notes?: string | null;
    startDate: string; // ISO
    monthsCount?: number | null;
    isActive?: boolean;
    deductOnGenerate?: boolean;
    accountId?: string | null;
  }): Promise<HouseholdRecurringPaymentDTO> {
    return this.post<HouseholdRecurringPaymentDTO>(this.endpoint, payload);
  }

  static async generate(payload?: { month?: string }): Promise<{
    month: string;
    created: number;
    skipped: number;
  }> {
    return this.post<{ month: string; created: number; skipped: number }>(
      `${this.endpoint}/generate`,
      payload ?? {}
    );
  }
}

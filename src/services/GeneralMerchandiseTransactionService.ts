import { BaseService } from './BaseService';
import type { TransactionDTO } from '../types';

/**
 * General Merchandise Transaction Service
 * Uses GM-scoped API routes under /api/general-merchandise
 */
export class GeneralMerchandiseTransactionService extends BaseService {
  protected static baseUrl = '/api/general-merchandise';
  private static endpoint = '/transactions';

  static async getAll(): Promise<TransactionDTO[]> {
    return this.get<TransactionDTO[]>(this.endpoint);
  }

  static async update(
    id: string | number,
    transaction: Partial<TransactionDTO>
  ): Promise<TransactionDTO> {
    return this.patch<TransactionDTO>(`${this.endpoint}`, {
      id,
      ...transaction,
    });
  }

  static async bulkUpdate(
    transactions: TransactionDTO[]
  ): Promise<{ count: number }> {
    return this.put<{ count: number }>(this.endpoint, transactions);
  }
}

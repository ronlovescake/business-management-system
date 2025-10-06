import { BaseService } from './BaseService';
import { TransactionDTO } from '../types';

/**
 * Transaction Service
 * Handles all transaction-related API operations
 */
export class TransactionService extends BaseService {
  private static endpoint = '/transactions';

  static async getAll(): Promise<TransactionDTO[]> {
    return this.get<TransactionDTO[]>(this.endpoint);
  }

  static async getById(id: string | number): Promise<TransactionDTO> {
    return this.get<TransactionDTO>(`${this.endpoint}/${id}`);
  }

  static async create(
    transaction: Partial<TransactionDTO>
  ): Promise<TransactionDTO> {
    return this.post<TransactionDTO>(this.endpoint, [transaction]);
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

  static async deleteById(id: string | number): Promise<void> {
    await this.deleteVoid(`${this.endpoint}/${id}`);
  }

  static async bulkCreate(
    transactions: Partial<TransactionDTO>[]
  ): Promise<{ count: number }> {
    return this.post<{ count: number }>(this.endpoint, transactions);
  }

  static async bulkUpdate(
    transactions: TransactionDTO[]
  ): Promise<{ count: number }> {
    return this.put<{ count: number }>(this.endpoint, transactions);
  }

  static async deleteAll(): Promise<{ count: number }> {
    return this.delete<{ count: number }>(this.endpoint);
  }

  // Transaction-specific methods
  static async getByCustomer(customerName: string): Promise<TransactionDTO[]> {
    return this.get<TransactionDTO[]>(
      `${this.endpoint}?customer=${encodeURIComponent(customerName)}`
    );
  }

  static async getByProductCode(
    productCode: string
  ): Promise<TransactionDTO[]> {
    return this.get<TransactionDTO[]>(
      `${this.endpoint}?productCode=${encodeURIComponent(productCode)}`
    );
  }

  static async getByStatus(status: string): Promise<TransactionDTO[]> {
    return this.get<TransactionDTO[]>(
      `${this.endpoint}?status=${encodeURIComponent(status)}`
    );
  }

  static async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<TransactionDTO[]> {
    return this.get<TransactionDTO[]>(
      `${this.endpoint}?startDate=${startDate}&endDate=${endDate}`
    );
  }
}

import { BaseService } from './BaseService';
import type { CustomerDTO } from '../types';

/**
 * Customer Service
 * Handles all customer-related API operations
 */
export class CustomerService extends BaseService {
  private static endpoint = '/customers';

  static async getAll(): Promise<CustomerDTO[]> {
    return this.get<CustomerDTO[]>(this.endpoint);
  }

  static async getById(id: string | number): Promise<CustomerDTO> {
    return this.get<CustomerDTO>(`${this.endpoint}/${id}`);
  }

  static async create(customer: Partial<CustomerDTO>): Promise<CustomerDTO> {
    return this.post<CustomerDTO>(this.endpoint, customer);
  }

  static async update(
    id: string | number,
    customer: Partial<CustomerDTO>
  ): Promise<CustomerDTO> {
    return this.put<CustomerDTO>(`${this.endpoint}/${id}`, customer);
  }

  static async deleteById(id: string | number): Promise<void> {
    await this.deleteVoid(`${this.endpoint}/${id}`);
  }

  static async bulkCreate(
    customers: Partial<CustomerDTO>[]
  ): Promise<{ count: number }> {
    return this.post<{ count: number }>(this.endpoint, customers);
  }

  static async bulkUpdate(
    customers: CustomerDTO[]
  ): Promise<{ count: number }> {
    return this.put<{ count: number }>(this.endpoint, customers);
  }

  static async deleteAll(): Promise<{ count: number }> {
    return this.delete<{ count: number }>(this.endpoint);
  }

  // Customer-specific methods
  static async searchByName(name: string): Promise<CustomerDTO[]> {
    return this.get<CustomerDTO[]>(
      `${this.endpoint}?search=${encodeURIComponent(name)}`
    );
  }

  static async getCustomerOrders(
    customerId: string | number
  ): Promise<unknown[]> {
    return this.get<unknown[]>(`${this.endpoint}/${customerId}/orders`);
  }

  static async getCustomerTransactions(
    customerId: string | number
  ): Promise<unknown[]> {
    return this.get<unknown[]>(`${this.endpoint}/${customerId}/transactions`);
  }
}

import { BaseService } from './BaseService';
import type { PriceDTO } from '../types';

/**
 * Price Service
 * Handles all price-related API operations
 */
export class PriceService extends BaseService {
  private static endpoint = '/prices';

  static async getAll(): Promise<PriceDTO[]> {
    return this.get<PriceDTO[]>(this.endpoint);
  }

  static async getById(id: string | number): Promise<PriceDTO> {
    return this.get<PriceDTO>(`${this.endpoint}/${id}`);
  }

  static async create(price: Partial<PriceDTO>): Promise<PriceDTO> {
    return this.post<PriceDTO>(this.endpoint, [price]);
  }

  static async update(
    id: string | number,
    price: Partial<PriceDTO>
  ): Promise<PriceDTO> {
    return this.put<PriceDTO>(`${this.endpoint}/${id}`, price);
  }

  static async deleteById(id: string | number): Promise<void> {
    await this.deleteVoid(`${this.endpoint}/${id}`);
  }

  static async bulkCreate(
    prices: Partial<PriceDTO>[]
  ): Promise<{ count: number }> {
    return this.post<{ count: number }>(this.endpoint, prices);
  }

  static async bulkUpdate(prices: PriceDTO[]): Promise<{ count: number }> {
    return this.put<{ count: number }>(this.endpoint, prices);
  }

  static async deleteAll(): Promise<{ count: number }> {
    return this.delete<{ count: number }>(this.endpoint);
  }

  // Price-specific methods
  static async getByProductCode(productCode: string): Promise<PriceDTO[]> {
    return this.get<PriceDTO[]>(
      `${this.endpoint}?productCode=${encodeURIComponent(productCode)}`
    );
  }

  static async getPriceTiers(productCode: string): Promise<PriceDTO[]> {
    return this.get<PriceDTO[]>(
      `${this.endpoint}/tiers?productCode=${encodeURIComponent(productCode)}`
    );
  }
}

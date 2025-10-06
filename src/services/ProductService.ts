import { BaseService } from './BaseService';
import { ProductDTO } from '../types';

/**
 * Product Service
 * Handles all product-related API operations
 */
export class ProductService extends BaseService {
  private static endpoint = '/products';

  static async getAll(): Promise<ProductDTO[]> {
    return this.get<ProductDTO[]>(this.endpoint);
  }

  static async getById(id: string | number): Promise<ProductDTO> {
    return this.get<ProductDTO>(`${this.endpoint}/${id}`);
  }

  static async create(product: Partial<ProductDTO>): Promise<ProductDTO> {
    return this.post<ProductDTO>(this.endpoint, [product]);
  }

  static async update(
    id: string | number,
    product: Partial<ProductDTO>
  ): Promise<ProductDTO> {
    return this.put<ProductDTO>(`${this.endpoint}/${id}`, product);
  }

  static async deleteById(id: string | number): Promise<void> {
    await this.deleteVoid(`${this.endpoint}/${id}`);
  }

  static async bulkCreate(
    products: Partial<ProductDTO>[]
  ): Promise<{ count: number }> {
    return this.post<{ count: number }>(this.endpoint, products);
  }

  static async bulkUpdate(products: ProductDTO[]): Promise<{ count: number }> {
    return this.put<{ count: number }>(this.endpoint, products);
  }

  static async deleteAll(): Promise<{ count: number }> {
    return this.delete<{ count: number }>(this.endpoint);
  }

  // Product-specific methods
  static async getByProductCode(productCode: string): Promise<ProductDTO[]> {
    return this.get<ProductDTO[]>(
      `${this.endpoint}?productCode=${encodeURIComponent(productCode)}`
    );
  }

  static async getByShipmentCode(shipmentCode: string): Promise<ProductDTO[]> {
    return this.get<ProductDTO[]>(
      `${this.endpoint}?shipmentCode=${encodeURIComponent(shipmentCode)}`
    );
  }
}

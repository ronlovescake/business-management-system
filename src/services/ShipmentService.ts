import { BaseService } from './BaseService';
import { ShipmentDTO } from '../types';

/**
 * Shipment Service
 * Handles all shipment-related API operations
 */
export class ShipmentService extends BaseService {
  private static endpoint = '/shipments';

  static async getAll(): Promise<ShipmentDTO[]> {
    return this.get<ShipmentDTO[]>(this.endpoint);
  }

  static async getById(id: string | number): Promise<ShipmentDTO> {
    return this.get<ShipmentDTO>(`${this.endpoint}/${id}`);
  }

  static async create(shipment: Partial<ShipmentDTO>): Promise<ShipmentDTO> {
    return this.post<ShipmentDTO>(this.endpoint, [shipment]);
  }

  static async update(
    id: string | number,
    shipment: Partial<ShipmentDTO>
  ): Promise<ShipmentDTO> {
    return this.put<ShipmentDTO>(`${this.endpoint}/${id}`, shipment);
  }

  static async deleteById(id: string | number): Promise<void> {
    await this.deleteVoid(`${this.endpoint}/${id}`);
  }

  static async bulkCreate(
    shipments: Partial<ShipmentDTO>[]
  ): Promise<{ count: number }> {
    return this.post<{ count: number }>(this.endpoint, shipments);
  }

  static async bulkUpdate(
    shipments: ShipmentDTO[]
  ): Promise<{ count: number }> {
    return this.put<{ count: number }>(this.endpoint, shipments);
  }

  static async deleteAll(): Promise<{ count: number }> {
    return this.delete<{ count: number }>(this.endpoint);
  }

  // Shipment-specific methods
  static async getByShipmentCode(shipmentCode: string): Promise<ShipmentDTO[]> {
    return this.get<ShipmentDTO[]>(
      `${this.endpoint}?shipmentCode=${encodeURIComponent(shipmentCode)}`
    );
  }

  static async getByStatus(status: string): Promise<ShipmentDTO[]> {
    return this.get<ShipmentDTO[]>(
      `${this.endpoint}?status=${encodeURIComponent(status)}`
    );
  }

  static async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<ShipmentDTO[]> {
    return this.get<ShipmentDTO[]>(
      `${this.endpoint}?startDate=${startDate}&endDate=${endDate}`
    );
  }
}

import { CustomerService } from './CustomerService';
import { ProductService } from './ProductService';
import { TransactionService } from './TransactionService';
import { ShipmentService } from './ShipmentService';
import { PriceService } from './PriceService';
import { FormatterService } from './FormatterService';
import { ValidationService } from './ValidationService';
import type { DataSourceType } from '../types';

/**
 * Service Factory
 * Provides a unified way to access all services
 */
export class ServiceFactory {
  private static services = {
    customers: CustomerService,
    products: ProductService,
    transactions: TransactionService,
    shipments: ShipmentService,
    prices: PriceService,
  } as const;

  static getService(type: DataSourceType) {
    const service = this.services[type];
    if (!service) {
      throw new Error(`Service not found for type: ${type}`);
    }
    return service;
  }

  // Simplified generic methods - use specific services for type safety
  static getCustomerService() {
    return CustomerService;
  }
  static getProductService() {
    return ProductService;
  }
  static getTransactionService() {
    return TransactionService;
  }
  static getShipmentService() {
    return ShipmentService;
  }
  static getPriceService() {
    return PriceService;
  }
  static getFormatterService() {
    return FormatterService;
  }
  static getValidationService() {
    return ValidationService;
  }
}

// Export all services for direct access
export {
  CustomerService,
  ProductService,
  TransactionService,
  ShipmentService,
  PriceService,
  FormatterService,
  ValidationService,
};

// Export service factory as default
export default ServiceFactory;

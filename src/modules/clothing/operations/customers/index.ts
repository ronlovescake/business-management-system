/**
 * Customers Module - Public API
 *
 * This module provides customer management functionality including:
 * - Customer CRUD operations
 * - CSV import/export
 * - Multi-field search
 * - Customer statistics
 * - Business info auto-fill
 * - Form validation
 */

// Module configuration
export { customersModule } from './module.config';

// Types
export type {
  CustomerData,
  CustomerFormData,
  CustomerStats,
  ValidationResult,
  CSVImportResult,
  CustomerWithSearchIndex,
  CustomerStatus,
  CustomerStatusOption,
  CustomerColumnKey,
  CustomersAPIResponse,
  CustomerAPIError,
} from './types/customer.types';

// Services
export { CustomerService } from './services/CustomerService';
export { default as customerService } from './services/CustomerService';

// Hooks
export { useCustomersData } from './hooks/useCustomersData';
export { useCustomerForm } from './hooks/useCustomerForm';

// Components
export { CustomersPage } from './components/CustomersPage';
export { CustomerStatsCards } from './components/CustomerStatsCards';
export { AddCustomerModal } from './components/AddCustomerModal';

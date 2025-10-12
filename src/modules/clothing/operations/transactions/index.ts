/**
 * Transactions Module Public API
 *
 * Exports all public types, services, hooks, and components.
 */

// Module configuration
export { transactionsModule } from './module.config';

// Types
export type {
  TransactionData,
  PriceTier,
  ProductShipmentMapping,
  CustomerValidationResult,
  CustomerWarningData,
  InvoiceConfirmationData,
  PackingListConfirmationData,
  DistributionConfirmationData,
  TransactionStatistics,
  ColumnIdToKey,
  OrderStatus,
  StatusFilterOption,
  PackingListTransaction,
  SanitizedTransaction,
} from './types/transaction.types';

export {
  ORDER_STATUS_OPTIONS,
  STATUS_FILTER_OPTIONS,
  ALL_STATUS_CONTROLLED_STATUSES,
} from './types/transaction.types';

// Services
export { TransactionService } from './services/TransactionService';

// Hooks
export { useTransactionsData } from './hooks/useTransactionsData';
export { useTransactionOperations } from './hooks/useTransactionOperations';
export { useTransactionModals } from './hooks/useTransactionModals';

// Components
export { TransactionsPage } from './components/TransactionsPage';
export {
  InvoiceGenerationModal,
  PackingListGenerationModal,
  DistributionGenerationModal,
  CustomerWarningModal,
} from './components/TransactionModals';

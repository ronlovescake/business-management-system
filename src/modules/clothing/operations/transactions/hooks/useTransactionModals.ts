'use client';

/**
 * useTransactionModals Hook
 *
 * Orchestrates focused modal-generation hooks for TransactionsPage.
 */

import { useCallback } from 'react';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { useCustomerWarningState } from './useCustomerWarningState';
import { useDistributionGeneration } from './useDistributionGeneration';
import { useInvoiceGeneration } from './useInvoiceGeneration';
import { usePackingListGeneration } from './usePackingListGeneration';
import type {
  TransactionData,
  DistributionConfirmationData,
  CustomerWarningData,
} from '../types/transaction.types';

interface UseTransactionModalsProps {
  transactions: TransactionData[];
  bulkUpdate: (data: TransactionData[]) => void;
  apiBasePath?: string;
}

interface UseTransactionModalsReturn {
  isGeneratingInvoice: boolean;
  prepareInvoiceGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  generateTwentyPercentReservationInvoices: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;

  isGeneratingPackingList: boolean;
  preparePackingListGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;

  showDistributionModal: boolean;
  distributionData: DistributionConfirmationData;
  pendingDistributionData: TransactionData[] | null;
  isGeneratingDistribution: boolean;
  prepareDistributionGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  confirmDistributionGeneration: () => Promise<void>;
  cancelDistributionGeneration: () => void;

  showCustomerWarningModal: boolean;
  customerWarningData: CustomerWarningData | null;
  setCustomerWarningData: (data: CustomerWarningData | null) => void;
  setShowCustomerWarningModal: (show: boolean) => void;
}

export function useTransactionModals(
  props: UseTransactionModalsProps
): UseTransactionModalsReturn {
  const { transactions, bulkUpdate, apiBasePath } = props;
  const customerLookupBasePath =
    apiBasePath === '/api/general-merchandise' ? undefined : apiBasePath;

  const {
    showCustomerWarningModal,
    customerWarningData,
    setCustomerWarningData,
    setShowCustomerWarningModal,
  } = useCustomerWarningState();

  const saveTransactionToDatabase = useCallback(
    async (transaction: TransactionData) => {
      try {
        return await api.patch<TransactionData>(
          buildApiPath(apiBasePath, '/transactions'),
          transaction
        );
      } catch (error) {
        logger.error('Error saving transaction:', error);
        throw error;
      }
    },
    [apiBasePath]
  );

  const {
    isGeneratingInvoice,
    prepareInvoiceGeneration,
    generateTwentyPercentReservationInvoices,
  } = useInvoiceGeneration({
    transactions,
    bulkUpdate,
    apiBasePath,
    customerLookupBasePath,
    saveTransactionToDatabase,
  });

  const { isGeneratingPackingList, preparePackingListGeneration } =
    usePackingListGeneration({
      transactions,
      bulkUpdate,
      apiBasePath,
      saveTransactionToDatabase,
    });

  const {
    showDistributionModal,
    distributionData,
    pendingDistributionData,
    isGeneratingDistribution,
    prepareDistributionGeneration,
    confirmDistributionGeneration,
    cancelDistributionGeneration,
  } = useDistributionGeneration({ apiBasePath });

  return {
    isGeneratingInvoice,
    prepareInvoiceGeneration,
    generateTwentyPercentReservationInvoices,

    isGeneratingPackingList,
    preparePackingListGeneration,

    showDistributionModal,
    distributionData,
    pendingDistributionData,
    isGeneratingDistribution,
    prepareDistributionGeneration,
    confirmDistributionGeneration,
    cancelDistributionGeneration,

    showCustomerWarningModal,
    customerWarningData,
    setCustomerWarningData,
    setShowCustomerWarningModal,
  };
}

'use client';

import { useCallback, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
import type {
  DistributionConfirmationData,
  TransactionData,
} from '../types/transaction.types';

interface UseDistributionGenerationProps {
  apiBasePath?: string;
}

interface UseDistributionGenerationReturn {
  showDistributionModal: boolean;
  distributionData: DistributionConfirmationData;
  pendingDistributionData: TransactionData[] | null;
  isGeneratingDistribution: boolean;
  prepareDistributionGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  confirmDistributionGeneration: () => Promise<void>;
  cancelDistributionGeneration: () => void;
}

const INITIAL_DISTRIBUTION_DATA: DistributionConfirmationData = {
  warehouseTransactions: 0,
  customers: 0,
  totalValue: 0,
  totalQuantity: 0,
};

export function useDistributionGeneration(
  props: UseDistributionGenerationProps
): UseDistributionGenerationReturn {
  const { apiBasePath } = props;

  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [distributionData, setDistributionData] =
    useState<DistributionConfirmationData>(INITIAL_DISTRIBUTION_DATA);
  const [pendingDistributionData, setPendingDistributionData] = useState<
    TransactionData[] | null
  >(null);
  const [isGeneratingDistribution, setIsGeneratingDistribution] =
    useState(false);

  const getNormalizedStatus = (value: string | null | undefined) =>
    normalizeOrderStatus(value);

  const prepareDistributionGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      const warehouse = visibleTransactions.filter((transaction) => {
        const status = getNormalizedStatus(transaction['Order Status']);
        return status === 'warehouse' || status === 'prepared';
      });

      if (warehouse.length === 0) {
        showNotification({
          title: '⚠️ No Warehouse/Prepared Transactions',
          message:
            'No visible transactions with "Warehouse" or "Prepared" status found.',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

      const uniqueCustomers = new Set(
        warehouse.map((transaction) => transaction.Customers).filter(Boolean)
      );
      const totalValue = warehouse.reduce(
        (sum, transaction) => sum + (Number(transaction['Line Total']) || 0),
        0
      );
      const totalQuantity = warehouse.reduce(
        (sum, transaction) => sum + (Number(transaction.Quantity) || 0),
        0
      );

      setDistributionData({
        warehouseTransactions: warehouse.length,
        customers: uniqueCustomers.size,
        totalValue,
        totalQuantity,
      });
      setPendingDistributionData(visibleTransactions);
      setShowDistributionModal(true);
    },
    []
  );

  const confirmDistributionGeneration = useCallback(async () => {
    setShowDistributionModal(false);

    if (!pendingDistributionData) {
      showNotification({
        title: '❌ Error',
        message: 'No distribution data available',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    setIsGeneratingDistribution(true);

    try {
      const warehouse = pendingDistributionData.filter((transaction) => {
        const status = getNormalizedStatus(transaction['Order Status']);
        return status === 'warehouse' || status === 'prepared';
      });

      const response = await fetch(
        buildApiPath(apiBasePath, '/generate-distribution'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transactions: warehouse }),
        }
      );

      if (response.ok) {
        const pdfBlob = await response.blob();
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:-]/g, '');
        link.download = `distribution-slips-${timestamp}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        showNotification({
          title: '✅ Distribution Slips Generated',
          message: `PDF with ${warehouse.length} distribution slips downloaded`,
          color: 'green',
          autoClose: 8000,
        });
      } else {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(
          errorData.error || 'Failed to generate distribution slips'
        );
      }
    } catch (error) {
      logger.error('Error generating distribution slips:', error);
      showNotification({
        title: '❌ Distribution Generation Failed',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      setIsGeneratingDistribution(false);
      setPendingDistributionData(null);
    }
  }, [apiBasePath, pendingDistributionData]);

  const cancelDistributionGeneration = useCallback(() => {
    setShowDistributionModal(false);
    setPendingDistributionData(null);

    showNotification({
      title: '✅ Distribution Generation Cancelled',
      message: 'Cancelled by user.',
      color: 'blue',
      autoClose: 4000,
    });
  }, []);

  return {
    showDistributionModal,
    distributionData,
    pendingDistributionData,
    isGeneratingDistribution,
    prepareDistributionGeneration,
    confirmDistributionGeneration,
    cancelDistributionGeneration,
  };
}

'use client';

/**
 * useTransactionModals Hook
 *
 * Manages state for all transaction modal dialogs:
 * - Invoice generation confirmation
 * - Packing list confirmation
 * - Distribution confirmation
 * - Customer warning
 */

import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { TransactionService } from '../services/TransactionService';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import type {
  TransactionData,
  InvoiceConfirmationData,
  PackingListConfirmationData,
  DistributionConfirmationData,
  CustomerWarningData,
} from '../types/transaction.types';

interface UseTransactionModalsProps {
  transactions: TransactionData[];
  bulkUpdate: (data: TransactionData[]) => void;
}

interface UseTransactionModalsReturn {
  // Invoice generation
  showInvoiceModal: boolean;
  invoiceData: InvoiceConfirmationData;
  pendingInvoiceData: TransactionData[] | null;
  isGeneratingInvoice: boolean;
  prepareInvoiceGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  confirmInvoiceGeneration: () => Promise<void>;
  cancelInvoiceGeneration: () => void;

  // Packing list generation
  showPackingListModal: boolean;
  packingListData: PackingListConfirmationData;
  pendingPackingListData: TransactionData[] | null;
  isGeneratingPackingList: boolean;
  preparePackingListGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  confirmPackingListGeneration: () => Promise<void>;
  cancelPackingListGeneration: () => void;

  // Distribution generation
  showDistributionModal: boolean;
  distributionData: DistributionConfirmationData;
  pendingDistributionData: TransactionData[] | null;
  isGeneratingDistribution: boolean;
  prepareDistributionGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  confirmDistributionGeneration: () => Promise<void>;
  cancelDistributionGeneration: () => void;

  // Customer warning
  showCustomerWarningModal: boolean;
  customerWarningData: CustomerWarningData | null;
  setCustomerWarningData: (data: CustomerWarningData | null) => void;
  setShowCustomerWarningModal: (show: boolean) => void;
}

export function useTransactionModals(
  props: UseTransactionModalsProps
): UseTransactionModalsReturn {
  const { transactions, bulkUpdate } = props;

  // ============================================================================
  // INVOICE GENERATION STATE
  // ============================================================================

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceConfirmationData>({
    customers: 0,
    warehouseOrders: 0,
    preparedOrders: 0,
    totalTransactions: 0,
  });
  const [pendingInvoiceData, setPendingInvoiceData] = useState<
    TransactionData[] | null
  >(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // ============================================================================
  // PACKING LIST STATE
  // ============================================================================

  const [showPackingListModal, setShowPackingListModal] = useState(false);
  const [packingListData, setPackingListData] =
    useState<PackingListConfirmationData>({
      eligibleTransactions: 0,
      customers: 0,
      totalValue: 0,
    });
  const [pendingPackingListData, setPendingPackingListData] = useState<
    TransactionData[] | null
  >(null);
  const [isGeneratingPackingList, setIsGeneratingPackingList] = useState(false);

  // ============================================================================
  // DISTRIBUTION STATE
  // ============================================================================

  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [distributionData, setDistributionData] =
    useState<DistributionConfirmationData>({
      warehouseTransactions: 0,
      customers: 0,
      totalValue: 0,
      totalQuantity: 0,
    });
  const [pendingDistributionData, setPendingDistributionData] = useState<
    TransactionData[] | null
  >(null);
  const [isGeneratingDistribution, setIsGeneratingDistribution] =
    useState(false);

  // ============================================================================
  // CUSTOMER WARNING STATE
  // ============================================================================

  const [showCustomerWarningModal, setShowCustomerWarningModal] =
    useState(false);
  const [customerWarningData, setCustomerWarningData] =
    useState<CustomerWarningData | null>(null);

  // ============================================================================
  // HELPER: Save transaction to database
  // ============================================================================

  const saveTransactionToDatabase = useCallback(
    async (transaction: TransactionData) => {
      try {
        return await api.patch<TransactionData>(
          '/api/transactions',
          transaction
        );
      } catch (error) {
        logger.error('Error saving transaction:', error);
        throw error;
      }
    },
    []
  );

  // ============================================================================
  // INVOICE GENERATION
  // ============================================================================

  const prepareInvoiceGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      logger.debug(
        '📄 Preparing invoice generation for customers with Warehouse orders...'
      );

      try {
        const warehouseTransactions = visibleTransactions.filter(
          (t) => t['Order Status'] === 'Warehouse'
        );

        if (warehouseTransactions.length === 0) {
          notifications.show({
            title: '⚠️ No Warehouse Transactions',
            message:
              'No visible transactions with "Warehouse" status found for invoice generation.',
            color: 'yellow',
            autoClose: 5000,
          });
          return;
        }

        const customersWithWarehouse = new Set(
          warehouseTransactions.map((t) => t.Customers).filter(Boolean)
        );

        let totalWarehouse = 0;
        let totalPrepared = 0;

        customersWithWarehouse.forEach((customerName) => {
          const customerWarehouse = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName && t['Order Status'] === 'Warehouse'
          );
          const customerPrepared = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName && t['Order Status'] === 'Prepared'
          );

          totalWarehouse += customerWarehouse.length;
          totalPrepared += customerPrepared.length;
        });

        setInvoiceData({
          customers: customersWithWarehouse.size,
          warehouseOrders: totalWarehouse,
          preparedOrders: totalPrepared,
          totalTransactions: totalWarehouse + totalPrepared,
        });
        setPendingInvoiceData(visibleTransactions);
        setShowInvoiceModal(true);
      } catch (error) {
        logger.error('Error preparing invoice generation:', error);
        notifications.show({
          title: '❌ Invoice Preparation Failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
          color: 'red',
          autoClose: 7000,
        });
      }
    },
    []
  );

  const confirmInvoiceGeneration = useCallback(async () => {
    setShowInvoiceModal(false);

    if (!pendingInvoiceData) {
      notifications.show({
        title: '❌ Error',
        message: 'No invoice data available for processing',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    logger.debug('📄 User confirmed - proceeding with invoice generation...');
    setIsGeneratingInvoice(true);

    try {
      const visibleTransactions = pendingInvoiceData;

      const warehouseTransactions = visibleTransactions.filter(
        (t) => t['Order Status'] === 'Warehouse'
      );

      const customersWithWarehouse = new Set(
        warehouseTransactions.map((t) => t.Customers).filter(Boolean)
      );

      const invoiceTransactions: TransactionData[] = [];
      let totalWarehouse = 0;
      let totalPrepared = 0;

      customersWithWarehouse.forEach((customerName) => {
        const customerWarehouse = visibleTransactions.filter(
          (t) =>
            t.Customers === customerName && t['Order Status'] === 'Warehouse'
        );
        const customerPrepared = visibleTransactions.filter(
          (t) =>
            t.Customers === customerName && t['Order Status'] === 'Prepared'
        );

        invoiceTransactions.push(...customerWarehouse, ...customerPrepared);
        totalWarehouse += customerWarehouse.length;
        totalPrepared += customerPrepared.length;
      });

      // Fetch customers for invoice
      let customersData: Record<string, unknown>[] = [];
      try {
        customersData =
          await api.get<Record<string, unknown>[]>('/api/customers');
      } catch {
        // Continue without customer data if it fails
        logger.warn('Failed to fetch customers data');
      }

      // Call invoice generation API
      // Note: Using raw fetch for blob response (API client doesn't handle blobs yet)
      const response = await fetch('/api/generate-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: invoiceTransactions,
          customers: customersData,
        }),
      });

      if (response.ok) {
        const pdfBlob = await response.blob();
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:-]/g, '');
        link.download = `invoices-${timestamp}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        const statusUpdateMessage =
          totalWarehouse > 0
            ? ` All ${totalWarehouse} Warehouse orders updated to Prepared status.`
            : '';

        notifications.show({
          title: '✅ Invoices Generated & Status Updated',
          message: `PDF with invoices for ${totalWarehouse} Warehouse + ${totalPrepared} Prepared orders from ${customersWithWarehouse.size} customers downloaded.${statusUpdateMessage}`,
          color: 'green',
          autoClose: 8000,
        });

        // Update transactions with invoice dates and status changes
        const currentDate = new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'Asia/Manila',
        });

        const processedIds = new Set(invoiceTransactions.map((t) => t.id));

        const updatedTransactions = transactions.map((t) => {
          const updates: Partial<TransactionData> = {};
          let hasUpdates = false;

          if (
            processedIds.has(t.id) &&
            (!t['Invoice Date'] || t['Invoice Date'].trim() === '')
          ) {
            updates['Invoice Date'] = currentDate;
            hasUpdates = true;
          }

          if (processedIds.has(t.id) && t['Order Status'] === 'Warehouse') {
            updates['Order Status'] = 'Prepared';
            hasUpdates = true;
          }

          return hasUpdates ? { ...t, ...updates } : t;
        });

        bulkUpdate(
          TransactionService.sanitizeTransactions(updatedTransactions)
        );

        // Save to database
        const toSave = updatedTransactions.filter((t) =>
          processedIds.has(t.id)
        );
        if (toSave.length > 0) {
          await Promise.all(toSave.map((t) => saveTransactionToDatabase(t)));
        }
      } else {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to generate invoices');
      }
    } catch (error) {
      logger.error('Error generating invoices:', error);
      notifications.show({
        title: '❌ Invoice Generation Failed',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      setIsGeneratingInvoice(false);
      setPendingInvoiceData(null);
    }
  }, [pendingInvoiceData, transactions, bulkUpdate, saveTransactionToDatabase]);

  const cancelInvoiceGeneration = useCallback(() => {
    setShowInvoiceModal(false);
    setPendingInvoiceData(null);

    notifications.show({
      title: '✅ Invoice Generation Cancelled',
      message:
        'Invoice generation was cancelled by user. No changes were made.',
      color: 'blue',
      autoClose: 4000,
    });
  }, []);

  // ============================================================================
  // PACKING LIST GENERATION (Similar pattern, abbreviated)
  // ============================================================================

  const preparePackingListGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      // Filter: "Prepared" status AND line total ≤ ₱50.00
      const eligible = visibleTransactions.filter((t) => {
        const status = t['Order Status'];
        const lineTotal = Number(t['Line Total']) || 0;
        return status === 'Prepared' && lineTotal <= 50.0;
      });

      if (eligible.length === 0) {
        notifications.show({
          title: '⚠️ No Prepared Transactions',
          message:
            'No visible transactions found with "Prepared" status and line total ≤ ₱50.00.',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

      const uniqueCustomers = new Set(
        eligible.map((t) => t.Customers).filter(Boolean)
      );
      const totalValue = eligible.reduce(
        (sum, t) => sum + (Number(t['Line Total']) || 0),
        0
      );

      setPackingListData({
        eligibleTransactions: eligible.length,
        customers: uniqueCustomers.size,
        totalValue,
      });
      setPendingPackingListData(visibleTransactions);
      setShowPackingListModal(true);
    },
    []
  );

  const confirmPackingListGeneration = useCallback(async () => {
    setShowPackingListModal(false);

    if (!pendingPackingListData) {
      notifications.show({
        title: '❌ Error',
        message: 'No packing list data available',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    setIsGeneratingPackingList(true);

    try {
      const eligible = pendingPackingListData.filter((t) => {
        const status = t['Order Status'];
        const lineTotal = Number(t['Line Total']) || 0;
        return status === 'Prepared' && lineTotal <= 50.0;
      });

      // Transform to the format expected by the API (with capitalized field names)
      const transformed = eligible.map((t) => ({
        Customers: t.Customers || '',
        'Product Code': t['Product Code'] || '',
        Quantity: Number(t.Quantity) || 0,
        Notes: t.Notes || '',
      }));

      // Note: Using raw fetch for blob response (API client doesn't handle blobs yet)
      const response = await fetch('/api/generate-packing-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactions: transformed }),
      });

      if (response.ok) {
        const pdfBlob = await response.blob();
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:-]/g, '');
        link.download = `packing-lists-${timestamp}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        notifications.show({
          title: '✅ Packing Lists Generated',
          message: `PDF with packing lists for ${eligible.length} transactions downloaded`,
          color: 'green',
          autoClose: 8000,
        });

        // Set packed dates
        const currentDate = new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'Asia/Manila',
        });

        const processedIds = new Set(eligible.map((t) => t.id));
        const updated = transactions.map((t) => {
          if (
            processedIds.has(t.id) &&
            (!t['Packed Date'] || t['Packed Date'].trim() === '')
          ) {
            return { ...t, 'Packed Date': currentDate };
          }
          return t;
        });

        bulkUpdate(TransactionService.sanitizeTransactions(updated));

        const toSave = updated.filter((t) => processedIds.has(t.id));
        if (toSave.length > 0) {
          await Promise.all(toSave.map((t) => saveTransactionToDatabase(t)));
        }
      } else {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to generate packing lists');
      }
    } catch (error) {
      logger.error('Error generating packing lists:', error);
      notifications.show({
        title: '❌ Packing List Generation Failed',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      setIsGeneratingPackingList(false);
      setPendingPackingListData(null);
    }
  }, [
    pendingPackingListData,
    transactions,
    bulkUpdate,
    saveTransactionToDatabase,
  ]);

  const cancelPackingListGeneration = useCallback(() => {
    setShowPackingListModal(false);
    setPendingPackingListData(null);

    notifications.show({
      title: '✅ Packing List Generation Cancelled',
      message: 'Cancelled by user.',
      color: 'blue',
      autoClose: 4000,
    });
  }, []);

  // ============================================================================
  // DISTRIBUTION GENERATION
  // ============================================================================

  const prepareDistributionGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      const warehouse = visibleTransactions.filter(
        (t) => t['Order Status'] === 'Warehouse'
      );

      if (warehouse.length === 0) {
        notifications.show({
          title: '⚠️ No Warehouse Transactions',
          message: 'No visible transactions with "Warehouse" status found.',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

      const uniqueCustomers = new Set(
        warehouse.map((t) => t.Customers).filter(Boolean)
      );
      const totalValue = warehouse.reduce(
        (sum, t) => sum + (Number(t['Line Total']) || 0),
        0
      );
      const totalQuantity = warehouse.reduce(
        (sum, t) => sum + (Number(t.Quantity) || 0),
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
      notifications.show({
        title: '❌ Error',
        message: 'No distribution data available',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    setIsGeneratingDistribution(true);

    try {
      const warehouse = pendingDistributionData.filter(
        (t) => t['Order Status'] === 'Warehouse'
      );

      // Note: Using raw fetch for blob response (API client doesn't handle blobs yet)
      const response = await fetch('/api/generate-distribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactions: warehouse }),
      });

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

        notifications.show({
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
      notifications.show({
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
  }, [pendingDistributionData]);

  const cancelDistributionGeneration = useCallback(() => {
    setShowDistributionModal(false);
    setPendingDistributionData(null);

    notifications.show({
      title: '✅ Distribution Generation Cancelled',
      message: 'Cancelled by user.',
      color: 'blue',
      autoClose: 4000,
    });
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Invoice
    showInvoiceModal,
    invoiceData,
    pendingInvoiceData,
    isGeneratingInvoice,
    prepareInvoiceGeneration,
    confirmInvoiceGeneration,
    cancelInvoiceGeneration,

    // Packing list
    showPackingListModal,
    packingListData,
    pendingPackingListData,
    isGeneratingPackingList,
    preparePackingListGeneration,
    confirmPackingListGeneration,
    cancelPackingListGeneration,

    // Distribution
    showDistributionModal,
    distributionData,
    pendingDistributionData,
    isGeneratingDistribution,
    prepareDistributionGeneration,
    confirmDistributionGeneration,
    cancelDistributionGeneration,

    // Customer warning
    showCustomerWarningModal,
    customerWarningData,
    setCustomerWarningData,
    setShowCustomerWarningModal,
  };
}

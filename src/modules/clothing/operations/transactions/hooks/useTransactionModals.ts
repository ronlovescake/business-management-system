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
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
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

  const [showInvoiceModal] = useState(false); // No longer used with SweetAlert
  const [invoiceData] = useState<InvoiceConfirmationData>({
    customers: 0,
    warehouseOrders: 0,
    preparedOrders: 0,
    totalTransactions: 0,
  }); // No longer used with SweetAlert
  const [_pendingInvoiceData, _setPendingInvoiceData] = useState<
    TransactionData[] | null
  >(null); // No longer used with SweetAlert
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // ============================================================================
  // PACKING LIST STATE
  // ============================================================================

  const [showPackingListModal] = useState(false); // No longer used with SweetAlert
  const [packingListData] = useState<PackingListConfirmationData>({
    eligibleTransactions: 0,
    customers: 0,
    totalValue: 0,
  }); // No longer used with SweetAlert
  const [_pendingPackingListData, _setPendingPackingListData] = useState<
    TransactionData[] | null
  >(null); // No longer used with SweetAlert
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
          showNotification({
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
        let totalOnHold = 0;

        customersWithWarehouse.forEach((customerName) => {
          const customerWarehouse = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName && t['Order Status'] === 'Warehouse'
          );
          const customerPrepared = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName && t['Order Status'] === 'Prepared'
          );
          const customerOnHold = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName && t['Order Status'] === 'On-Hold'
          );

          totalWarehouse += customerWarehouse.length;
          totalPrepared += customerPrepared.length;
          totalOnHold += customerOnHold.length;
        });

        const totalTransactions = totalWarehouse + totalPrepared + totalOnHold;

        // Show SweetAlert2 confirmation dialog
        const result = await Swal.fire({
          title: 'Invoice Generation Confirmation',
          html: `
            <div style="text-align: left;">
              <div style="background-color: #fff3cd; padding: 12px; margin-bottom: 16px; border-radius: 4px; border: 1px solid #ffc107;">
                <p style="margin: 0; color: #856404; font-weight: 500;">Important Changes Will Occur</p>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #856404;">
                  This action will modify your data and cannot be undone. Please review the details below.
                </p>
              </div>

              <p style="font-weight: 500; margin-bottom: 12px;">You are about to generate invoices for:</p>
              
              <div style="margin-bottom: 16px;">
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${customersWithWarehouse.size}</strong> customer${customersWithWarehouse.size > 1 ? 's' : ''}
                </p>
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${totalWarehouse}</strong> Warehouse order${totalWarehouse > 1 ? 's' : ''}
                </p>
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${totalPrepared}</strong> Prepared order${totalPrepared > 1 ? 's' : ''}
                </p>
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${totalOnHold}</strong> On-Hold order${totalOnHold > 1 ? 's' : ''}
                </p>
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${totalTransactions}</strong> total transactions
                </p>
              </div>

              <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

              <p style="font-weight: 500; margin-bottom: 12px;">Important Changes That Will Occur:</p>
              <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #495057;">
                <li>All ${totalWarehouse} Warehouse order${totalWarehouse > 1 ? 's' : ''} will be updated to "Prepared" status</li>
                <li>Invoice dates will be set for all processed transactions</li>
                <li>A PDF invoice will be generated and downloaded</li>
                <li>All changes will be saved to the database</li>
              </ul>

              <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

              <p style="text-align: center; color: #868e96; font-size: 14px; margin: 0;">
                Do you want to proceed with invoice generation?
              </p>
            </div>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Generate Invoices',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#2196F3',
          cancelButtonColor: '#868e96',
          width: '600px',
          allowOutsideClick: false,
          customClass: {
            popup: 'swal-wide',
            confirmButton: 'swal-confirm-btn',
            cancelButton: 'swal-cancel-btn',
          },
        });

        if (!result.isConfirmed) {
          showNotification({
            title: '✅ Invoice Generation Cancelled',
            message: 'No changes were made.',
            color: 'blue',
            autoClose: 4000,
          });
          return;
        }

        // User confirmed, proceed with generation
        logger.debug(
          '📄 User confirmed - proceeding with invoice generation...'
        );
        setIsGeneratingInvoice(true);

        const invoiceTransactions: TransactionData[] = [];
        customersWithWarehouse.forEach((customerName) => {
          const customerWarehouse = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName && t['Order Status'] === 'Warehouse'
          );
          const customerPrepared = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName && t['Order Status'] === 'Prepared'
          );
          const customerOnHold = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName && t['Order Status'] === 'On-Hold'
          );

          invoiceTransactions.push(
            ...customerWarehouse,
            ...customerPrepared,
            ...customerOnHold
          );
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
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;

          // Get filename from Content-Disposition header or use default
          const contentDisposition = response.headers.get(
            'Content-Disposition'
          );
          let filename = 'invoices.pdf';

          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(
              /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
            );
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1].replace(/['"]/g, '');
              // Decode URL-encoded filename
              filename = decodeURIComponent(filename);
            }
          }

          // If no filename from header, determine from content type
          if (filename === 'invoices.pdf') {
            const contentType = response.headers.get('Content-Type');
            const timestamp = new Date()
              .toISOString()
              .slice(0, 19)
              .replace(/[:-]/g, '');

            if (contentType?.includes('zip')) {
              filename = `invoices-${timestamp}.zip`;
            } else {
              filename = `invoices-${timestamp}.pdf`;
            }
          }

          link.download = filename;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          const statusUpdateMessage =
            totalWarehouse > 0
              ? ` All ${totalWarehouse} Warehouse orders updated to Prepared status.`
              : '';

          const statusSummary = `${totalWarehouse} Warehouse + ${totalPrepared} Prepared + ${totalOnHold} On-Hold`;

          const fileType = filename.endsWith('.zip')
            ? 'ZIP file with individual PDFs'
            : 'PDF';

          showNotification({
            title: '✅ Invoices Generated & Status Updated',
            message: `${fileType} for ${statusSummary} orders from ${customersWithWarehouse.size} customer${customersWithWarehouse.size > 1 ? 's' : ''} downloaded.${statusUpdateMessage}`,
            color: 'green',
            autoClose: 8000,
          });

          // Update transactions with invoice dates and status changes
          // Store as ISO timestamp to preserve exact time
          // JavaScript Date automatically uses the system/browser timezone (Manila in your case)
          const currentDateISO = new Date().toISOString();

          const processedIds = new Set(invoiceTransactions.map((t) => t.id));

          const updatedTransactions = transactions.map((t) => {
            const updates: Partial<TransactionData> = {};
            let hasUpdates = false;

            if (
              processedIds.has(t.id) &&
              (!t['Invoice Date'] || t['Invoice Date'].trim() === '')
            ) {
              updates['Invoice Date'] = currentDateISO;
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
        logger.error('Error preparing/generating invoices:', error);
        showNotification({
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
      }
    },
    [transactions, bulkUpdate, saveTransactionToDatabase]
  );

  // Dummy functions for backward compatibility (no longer used with SweetAlert)
  const confirmInvoiceGeneration = useCallback(async () => {
    // This function is no longer called - logic is now inline in prepareInvoiceGeneration
  }, []);

  const cancelInvoiceGeneration = useCallback(() => {
    // This function is no longer called - cancellation is handled by SweetAlert
  }, []);

  // ============================================================================
  // PACKING LIST GENERATION (Similar pattern, abbreviated)
  // ============================================================================

  const preparePackingListGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      // Count all "Prepared" orders (regardless of line total)
      const allPrepared = visibleTransactions.filter((t) => {
        const status = t['Order Status'];
        return status === 'Prepared';
      });

      // Filter: customers that have at least one Prepared order
      const customersWithPrepared = new Set(
        allPrepared.map((t) => t.Customers).filter(Boolean)
      );

      // Final eligible set: Prepared ≤ ₱50.00 plus On-Hold for customers who also have Prepared
      const eligible = visibleTransactions.filter((t) => {
        const status = t['Order Status'];
        const customerName = t.Customers;
        const lineTotal = Number(t['Line Total']) || 0;

        // Always apply original Prepared ≤ ₱50 rule
        if (status === 'Prepared' && lineTotal <= 50.0) {
          return true;
        }

        // Include On-Hold only if this customer has at least one Prepared order
        if (
          status === 'On-Hold' &&
          customerName &&
          customersWithPrepared.has(customerName)
        ) {
          return true;
        }

        return false;
      });

      if (eligible.length === 0) {
        showNotification({
          title: '⚠️ No Prepared Transactions',
          message:
            'No visible transactions found with "Prepared" status and line total ≤ ₱50.00.',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

      // Check if any customer has SPLIT orders (some included, some excluded)
      // Group all "Prepared" orders by customer (split logic still based on Prepared only)
      const customerOrdersMap = new Map<
        string,
        { eligible: number; excluded: number }
      >();

      allPrepared.forEach((t) => {
        const customerName = t.Customers || 'Unknown';
        const lineTotal = Number(t['Line Total']) || 0;
        const isEligible = lineTotal <= 50.0;

        if (!customerOrdersMap.has(customerName)) {
          customerOrdersMap.set(customerName, { eligible: 0, excluded: 0 });
        }

        const counts = customerOrdersMap.get(customerName);
        if (counts) {
          if (isEligible) {
            counts.eligible++;
          } else {
            counts.excluded++;
          }
        }
      });

      // Find customers with SPLIT orders (both eligible and excluded orders)
      const customersWithSplitOrders = Array.from(customerOrdersMap.entries())
        .filter(([_, counts]) => counts.eligible > 0 && counts.excluded > 0)
        .map(([customerName, counts]) => ({
          customerName,
          ...counts,
        }));

      // Warn user if any customer has split orders
      if (customersWithSplitOrders.length > 0) {
        const totalExcludedFromSplits = customersWithSplitOrders.reduce(
          (sum, c) => sum + c.excluded,
          0
        );

        const customerList = customersWithSplitOrders
          .map(
            (c) =>
              `<li><strong>${c.customerName}</strong>: ${c.eligible} order${c.eligible > 1 ? 's' : ''} will be included, but ${c.excluded} order${c.excluded > 1 ? 's' : ''} will be left behind (> ₱50.00)</li>`
          )
          .join('');

        await Swal.fire({
          title: '⚠️ Some Customers Have Split Orders',
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 12px;"><strong>${customersWithSplitOrders.length}</strong> customer${customersWithSplitOrders.length > 1 ? 's have' : ' has'} orders that will be <strong>split</strong>:</p>
              <ul style="margin: 12px 0; padding-left: 20px; font-size: 14px; color: #495057;">
                ${customerList}
              </ul>
              <p style="margin-top: 16px; padding: 12px; background-color: #fff3cd; border-radius: 4px; border: 1px solid #ffc107; color: #856404; font-size: 14px;">
                ⚠️ <strong>Warning:</strong> These customers will NOT receive all their orders in this packing list. Make sure to handle the excluded orders separately.
              </p>
              <p style="margin-top: 12px; font-size: 14px;">Total orders excluded from split customers: <strong>${totalExcludedFromSplits}</strong></p>
            </div>
          `,
          icon: 'warning',
          confirmButtonText: 'I Understand',
          confirmButtonColor: '#fd7e14',
          width: '650px',
          allowOutsideClick: false,
          customClass: {
            popup: 'swal-wide',
          },
        });
      }

      const uniqueCustomers = new Set(
        eligible.map((t) => t.Customers).filter(Boolean)
      );
      const totalValue = eligible.reduce(
        (sum, t) => sum + (Number(t['Line Total']) || 0),
        0
      );

      // Counts by status for clearer confirmation messaging
      const preparedCount = eligible.filter(
        (t) => t['Order Status'] === 'Prepared'
      ).length;
      const onHoldCount = eligible.filter(
        (t) => t['Order Status'] === 'On-Hold'
      ).length;

      // Show SweetAlert2 confirmation dialog
      const result = await Swal.fire({
        title: 'Packing List Generation Confirmation',
        html: `
          <div style="text-align: left;">
            <div style="padding: 12px 0; margin-bottom: 16px;">
              <p style="margin: 0; color: #212529; font-weight: 500;">Packing List Generation</p>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #495057;">
                This will generate packing lists for all eligible "Prepared" orders with line total ≤ ₱50.00, plus On-Hold orders for those same customers.
              </p>
            </div>

            <p style="font-weight: 500; margin-bottom: 12px;">You are about to generate packing lists for:</p>
            
            <div style="margin-bottom: 16px;">
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${eligible.length}</strong> eligible transactions
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${uniqueCustomers.size}</strong> customer${uniqueCustomers.size > 1 ? 's' : ''}
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${preparedCount}</strong> Prepared order${preparedCount !== 1 ? 's' : ''} and <strong>${onHoldCount}</strong> On-Hold order${onHoldCount !== 1 ? 's' : ''}
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                Total value: <strong>₱${totalValue.toLocaleString()}</strong>
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

            <p style="font-weight: 500; margin-bottom: 12px;">Eligibility Criteria:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #495057;">
              <li>Prepared transactions with line total ≤ ₱50.00</li>
              <li>On-Hold transactions are included only for customers that also have Prepared orders</li>
              <li>PDF packing lists will be generated and downloaded</li>
            </ul>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

            <p style="text-align: center; color: #868e96; font-size: 14px; margin: 0;">
              Do you want to proceed with packing list generation?
            </p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Generate Packing Lists',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#7950f2',
        cancelButtonColor: '#868e96',
        width: '600px',
        allowOutsideClick: false,
        customClass: {
          popup: 'swal-wide',
          confirmButton: 'swal-confirm-btn',
          cancelButton: 'swal-cancel-btn',
        },
      });

      if (!result.isConfirmed) {
        showNotification({
          title: '✅ Packing List Generation Cancelled',
          message: 'No changes were made.',
          color: 'blue',
          autoClose: 4000,
        });
        return;
      }

      // User confirmed, proceed with generation
      setIsGeneratingPackingList(true);

      try {
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

          showNotification({
            title: '✅ Packing Lists Generated',
            message: `PDF with packing lists for ${eligible.length} transactions downloaded`,
            color: 'green',
            autoClose: 8000,
          });

          // Fetch dispatch customer names to determine order status
          const dispatchCustomerNames: Set<string> = new Set();
          const normalizedDispatchCustomerNames: Set<string> = new Set();

          const normalizeName = (value: string | null | undefined) =>
            (value || '')
              .replace(/\s*\|\s*/g, ' | ')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();

          const collectNameVariants = (
            customerName: string | null | undefined,
            businessName: string | null | undefined
          ) => {
            const variants = new Set<string>();

            const sanitizedCustomer = (customerName || '').trim();
            const sanitizedBusiness = (businessName || '').trim();

            if (sanitizedCustomer) {
              variants.add(sanitizedCustomer);
            }

            if (sanitizedBusiness) {
              variants.add(sanitizedBusiness);
            }

            if (sanitizedCustomer && sanitizedBusiness) {
              variants.add(`${sanitizedCustomer} | ${sanitizedBusiness}`);
            }

            variants.forEach((variant) => {
              dispatchCustomerNames.add(variant);
              const normalized = normalizeName(variant);
              if (normalized) {
                normalizedDispatchCustomerNames.add(normalized);
              }
            });
          };
          try {
            // Step 1: Fetch dispatch orders to get usernames
            const dispatchResponse = await fetch('/api/dispatch/orders');
            logger.info('Dispatch response status:', dispatchResponse.status);

            if (dispatchResponse.ok) {
              const dispatchData = (await dispatchResponse.json()) as {
                success: boolean;
                data: Array<{ 'Username (Buyer)'?: string | null }>;
              };

              logger.info('Dispatch data received:', {
                success: dispatchData.success,
                totalOrders: dispatchData.data.length,
              });

              // Extract unique usernames from dispatch orders
              const dispatchUsernames = Array.from(
                new Set(
                  dispatchData.data
                    .map((order) => order['Username (Buyer)'])
                    .filter((username): username is string => Boolean(username))
                )
              );

              logger.info('Dispatch usernames:', {
                count: dispatchUsernames.length,
                usernames: dispatchUsernames,
              });

              if (dispatchUsernames.length > 0) {
                // Step 2: Fetch customers with Shopee usernames for matching
                const customersResponse = await fetch(
                  '/api/customers/with-shopee'
                );
                logger.info(
                  'Customers with Shopee response status:',
                  customersResponse.status
                );

                if (customersResponse.ok) {
                  const customersData = (await customersResponse.json()) as {
                    success: boolean;
                    data: Array<{
                      id: number;
                      customerName: string;
                      businessName: string;
                      shopeeUsernames: string[];
                    }>;
                  };

                  logger.info('Customers with Shopee data received:', {
                    success: customersData.success,
                    totalCustomers: customersData.data.length,
                  });

                  // Step 3: Match dispatch usernames to customer names
                  dispatchUsernames.forEach((username) => {
                    const normalizedUsername = username.toLowerCase().trim();
                    const matchedCustomer = customersData.data.find(
                      (customer) =>
                        customer.shopeeUsernames
                          .map((u) => u.toLowerCase().trim())
                          .includes(normalizedUsername)
                    );

                    if (matchedCustomer) {
                      collectNameVariants(
                        matchedCustomer.customerName,
                        matchedCustomer.businessName
                      );
                    }
                  });

                  logger.info('✅ Dispatch customer names matched:', {
                    count: dispatchCustomerNames.size,
                    names: Array.from(dispatchCustomerNames),
                  });
                } else {
                  logger.error(
                    'Failed to fetch customers with Shopee:',
                    customersResponse.statusText
                  );
                }
              } else {
                logger.warn('No usernames found in dispatch orders');
              }
            } else {
              logger.error(
                'Failed to fetch dispatch orders:',
                dispatchResponse.statusText
              );
            }
          } catch (error) {
            logger.error('Error fetching dispatch data:', error);
          }

          // Set packed dates and order status
          const currentDate = new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Manila',
          });

          const processedIds = new Set(eligible.map((t) => t.id));
          const updated = transactions.map((t) => {
            if (processedIds.has(t.id)) {
              const customerName = t.Customers || '';

              const transactionNameVariants = new Set<string>();
              if (customerName) {
                transactionNameVariants.add(customerName);
                const [primary, secondary] = customerName
                  .split('|')
                  .map((part) => part.trim());
                if (primary) {
                  transactionNameVariants.add(primary);
                }
                if (secondary) {
                  transactionNameVariants.add(secondary);
                }
              }

              const isInDispatch = Array.from(transactionNameVariants).some(
                (nameVariant) =>
                  normalizedDispatchCustomerNames.has(
                    normalizeName(nameVariant)
                  )
              );
              const orderStatus = isInDispatch
                ? 'Checked Out'
                : 'Ready For Dispatch';

              logger.info(
                `Customer "${customerName}": ${isInDispatch ? '✅ FOUND in dispatch' : '❌ NOT in dispatch'} → Status: ${orderStatus}`
              );

              // Only update Packed Date if empty
              const packedDate =
                !t['Packed Date'] || t['Packed Date'].trim() === ''
                  ? currentDate
                  : t['Packed Date'];

              return {
                ...t,
                'Packed Date': packedDate,
                'Order Status': orderStatus,
              };
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
          throw new Error(
            errorData.error || 'Failed to generate packing lists'
          );
        }
      } catch (error) {
        logger.error('Error generating packing lists:', error);
        showNotification({
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
      }
    },
    [transactions, bulkUpdate, saveTransactionToDatabase]
  );

  // Dummy functions for backward compatibility (no longer used with SweetAlert)
  const confirmPackingListGeneration = useCallback(async () => {
    // This function is no longer called - logic is now inline in preparePackingListGeneration
  }, []);

  const cancelPackingListGeneration = useCallback(() => {
    // This function is no longer called - cancellation is handled by SweetAlert
  }, []);

  // ============================================================================
  // DISTRIBUTION GENERATION
  // ============================================================================

  const prepareDistributionGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      const warehouse = visibleTransactions.filter(
        (t) =>
          t['Order Status'] === 'Warehouse' || t['Order Status'] === 'Prepared'
      );

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
      const warehouse = pendingDistributionData.filter(
        (t) =>
          t['Order Status'] === 'Warehouse' || t['Order Status'] === 'Prepared'
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
  }, [pendingDistributionData]);

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

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Invoice (SweetAlert-based, modal state kept for compatibility)
    showInvoiceModal, // Always false now
    invoiceData, // Empty now
    pendingInvoiceData: null, // Not used anymore
    isGeneratingInvoice,
    prepareInvoiceGeneration,
    confirmInvoiceGeneration, // Dummy function
    cancelInvoiceGeneration, // Dummy function

    // Packing list (SweetAlert-based, modal state kept for compatibility)
    showPackingListModal, // Always false now
    packingListData, // Empty now
    pendingPackingListData: null, // Not used anymore
    isGeneratingPackingList,
    preparePackingListGeneration,
    confirmPackingListGeneration, // Dummy function
    cancelPackingListGeneration, // Dummy function

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

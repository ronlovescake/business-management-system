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
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
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
  generateTwentyPercentReservationInvoices: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;

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

interface ReservationInvoiceWorkflowConfig {
  invoiceType: 'Reservation Fee' | 'Reservation Fee 20';
  feePercentage: number;
  downloadBaseName: string;
}

type InvoiceSelection =
  | 'onhand'
  | 'inTransit'
  | 'reservation10'
  | 'reservation20';

export function useTransactionModals(
  props: UseTransactionModalsProps
): UseTransactionModalsReturn {
  const { transactions, bulkUpdate } = props;

  // ============================================================================
  // ⚠️ STATUS NORMALIZATION
  // ============================================================================
  // Normalize order-status comparisons to avoid casing/whitespace drift across
  // invoice, packing list, and distribution workflows.
  // ============================================================================
  const getNormalizedStatus = (value: string | null | undefined) =>
    normalizeOrderStatus(value);

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

  const handleInTransitInvoiceGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      logger.debug('🚚 Preparing In Transit invoice generation...');

      const inTransitTransactions = visibleTransactions.filter(
        (t) => getNormalizedStatus(t['Order Status']) === 'in transit'
      );

      if (inTransitTransactions.length === 0) {
        showNotification({
          title: '⚠️ No In Transit Transactions',
          message:
            'No visible transactions with "In Transit" status found for invoice generation.',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

      const customersWithInTransit = new Set(
        inTransitTransactions.map((t) => t.Customers).filter(Boolean)
      );

      const totalValue = inTransitTransactions.reduce(
        (sum, t) => sum + (Number(t['Line Total']) || 0),
        0
      );

      const result = await Swal.fire({
        title: 'In Transit Invoice Confirmation',
        html: `
          <div style="text-align: left;">
            <p style="margin-bottom: 12px; font-weight: 500;">You are about to generate In Transit invoices for:</p>
            <div style="margin-bottom: 16px;">
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${customersWithInTransit.size}</strong> customer${customersWithInTransit.size === 1 ? '' : 's'}
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${inTransitTransactions.length}</strong> In Transit order${inTransitTransactions.length === 1 ? '' : 's'}
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                Total value: <strong>₱${totalValue.toLocaleString()}</strong>
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

            <p style="margin-bottom: 12px; font-weight: 500;">Important Details:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #495057;">
              <li>Only transactions with "In Transit" status will be included</li>
              <li>Due date inside the invoice will show <strong>"NOT YET ONHAND"</strong></li>
              <li>No status or invoice date changes will be applied to these orders</li>
            </ul>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

            <p style="text-align: center; color: #868e96; font-size: 14px; margin: 0;">
              Do you want to proceed with In Transit invoice generation?
            </p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Generate In Transit Invoices',
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

      setIsGeneratingInvoice(true);

      try {
        let customersData: Record<string, unknown>[] = [];
        try {
          customersData =
            await api.get<Record<string, unknown>[]>('/api/customers');
        } catch {
          logger.warn('Failed to fetch customers data for In Transit invoices');
        }

        const response = await fetch('/api/generate-in-transit-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactions: inTransitTransactions,
            customers: customersData,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(
            errorData.error || 'Failed to generate In Transit invoices'
          );
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'in-transit-invoices.pdf';

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(
            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
          );
          if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(
              filenameMatch[1].replace(/['"]/g, '')
            );
          }
        }

        if (filename === 'in-transit-invoices.pdf') {
          const contentType = response.headers.get('Content-Type');
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[:-]/g, '');

          if (contentType?.includes('zip')) {
            filename = `in-transit-invoices-${timestamp}.zip`;
          } else if (contentType?.includes('png')) {
            filename = `in-transit-invoices-${timestamp}.png`;
          } else {
            filename = `in-transit-invoices-${timestamp}.pdf`;
          }
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        const fileType = filename.endsWith('.zip')
          ? 'ZIP file with individual invoices'
          : filename.endsWith('.png')
            ? 'PNG invoice'
            : 'PDF invoice';

        showNotification({
          title: '✅ In Transit Invoices Generated',
          message: `${fileType} for ${inTransitTransactions.length} In Transit order${inTransitTransactions.length === 1 ? '' : 's'} across ${customersWithInTransit.size} customer${customersWithInTransit.size === 1 ? '' : 's'} downloaded. Due date set to "NOT YET ONHAND" inside each invoice.`,
          color: 'green',
          autoClose: 8000,
        });
      } catch (error) {
        logger.error('Error generating In Transit invoices:', error);
        showNotification({
          title: '❌ In Transit Invoice Generation Failed',
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
    []
  );

  const runReservationInvoiceWorkflow = useCallback(
    async (
      visibleTransactions: TransactionData[],
      config: ReservationInvoiceWorkflowConfig
    ) => {
      const percentLabel = `${Math.round(config.feePercentage * 100)}%`;
      logger.debug(
        `💳 Preparing reservation-fee invoice generation (${percentLabel})...`
      );

      // Filter: Only "In Transit" orders with Adjustment = 0.00 (unpaid reservation fees)
      const reservationTransactions = visibleTransactions.filter(
        (t) =>
          getNormalizedStatus(t['Order Status']) === 'in transit' &&
          (Number(t.Adjustment) === 0 || !t.Adjustment)
      );

      if (reservationTransactions.length === 0) {
        showNotification({
          title: '⚠️ No Unpaid Reservations',
          message:
            'All visible "In Transit" orders have already paid their reservation fees (Adjustment ≠ 0.00).',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

      const customersWithReservations = new Set(
        reservationTransactions.map((t) => t.Customers).filter(Boolean)
      );

      const totalValue = reservationTransactions.reduce(
        (sum, t) => sum + (Number(t['Line Total']) || 0),
        0
      );
      const reservationFeeValue = Number(
        (totalValue * config.feePercentage).toFixed(2)
      );

      const result = await Swal.fire({
        title: `Reservation Fee Invoice Confirmation (${percentLabel})`,
        html: `
          <div style="text-align: left;">
            <p style="margin-bottom: 12px; font-weight: 500;">You are about to send reservation invoices (${percentLabel} fee) for:</p>
            <div style="margin-bottom: 16px;">
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${customersWithReservations.size}</strong> customer${customersWithReservations.size === 1 ? '' : 's'}
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${reservationTransactions.length}</strong> In Transit order${reservationTransactions.length === 1 ? '' : 's'}
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                Total order value: <strong>₱${totalValue.toLocaleString()}</strong>
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                Reservation fee (${percentLabel}): <strong>₱${reservationFeeValue.toLocaleString()}</strong>
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

            <p style="margin-bottom: 12px; font-weight: 500;">Important Details:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #495057;">
              <li>Invoices use the reservation template (24-hour payment reminder)</li>
              <li>Amount due per invoice is exactly ${percentLabel} of its subtotal</li>
              <li>No status or invoice date changes will be applied to these orders</li>
            </ul>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

            <p style="text-align: center; color: #868e96; font-size: 14px; margin: 0;">
              Do you want to proceed with Reservation Fee invoices?
            </p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Generate Reservation Invoices',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#cc0000',
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

      setIsGeneratingInvoice(true);

      try {
        let customersData: Record<string, unknown>[] = [];
        try {
          customersData =
            await api.get<Record<string, unknown>[]>('/api/customers');
        } catch {
          logger.warn(
            'Failed to fetch customers data for reservation invoices'
          );
        }

        const response = await fetch('/api/generate-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactions: reservationTransactions,
            customers: customersData,
            invoiceType: config.invoiceType,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(
            errorData.error || 'Failed to generate reservation invoices'
          );
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${config.downloadBaseName}.pdf`;

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(
            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
          );
          if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(
              filenameMatch[1].replace(/['"]/g, '')
            );
          }
        }

        if (filename === `${config.downloadBaseName}.pdf`) {
          const contentType = response.headers.get('Content-Type');
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[:-]/g, '');

          if (contentType?.includes('zip')) {
            filename = `${config.downloadBaseName}-${timestamp}.zip`;
          } else if (contentType?.includes('png')) {
            filename = `${config.downloadBaseName}-${timestamp}.png`;
          } else {
            filename = `${config.downloadBaseName}-${timestamp}.pdf`;
          }
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        const fileType = filename.endsWith('.zip')
          ? 'ZIP file with individual invoices'
          : filename.endsWith('.png')
            ? 'PNG invoice'
            : 'PDF invoice';

        showNotification({
          title: '✅ Reservation Fee Invoices Generated',
          message: `${fileType} for ${reservationTransactions.length} In Transit order${reservationTransactions.length === 1 ? '' : 's'} across ${customersWithReservations.size} customer${customersWithReservations.size === 1 ? '' : 's'} downloaded. Total ${percentLabel} reservation fees: ₱${reservationFeeValue.toLocaleString()}.`,
          color: 'green',
          autoClose: 8000,
        });
      } catch (error) {
        logger.error('Error generating reservation invoices:', error);
        showNotification({
          title: '❌ Reservation Invoice Generation Failed',
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
    []
  );

  const handleReservationInvoiceGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      await runReservationInvoiceWorkflow(visibleTransactions, {
        invoiceType: 'Reservation Fee',
        feePercentage: 0.1,
        downloadBaseName: 'reservation-fee-invoices',
      });
    },
    [runReservationInvoiceWorkflow]
  );

  const handleTwentyPercentReservationInvoiceGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      await runReservationInvoiceWorkflow(visibleTransactions, {
        invoiceType: 'Reservation Fee 20',
        feePercentage: 0.2,
        downloadBaseName: 'reservation-fee-20-invoices',
      });
    },
    [runReservationInvoiceWorkflow]
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
        const selection = await new Promise<InvoiceSelection | null>(
          (resolve) => {
            let resolved = false;
            Swal.fire({
              title: 'Select Invoice Type',
              html: `
                <div style="text-align: center;">
                  <p style="margin-bottom: 12px; color: #495057;">
                    Choose the invoice workflow you want to run:
                  </p>
                  <div style="display: flex; flex-wrap: nowrap; gap: 12px; justify-content: center; margin-top: 16px;">
                    <button type="button" class="swal2-styled" data-selection="onhand" style="background-color: #60bd52; padding: 10px 18px; min-width: 120px;">Onhand</button>
                    <button type="button" class="swal2-styled" data-selection="inTransit" style="background-color: #2196F3; padding: 10px 18px; min-width: 120px;">In Transit</button>
                    <button type="button" class="swal2-styled" data-selection="reservation10" style="background-color: #f06543; padding: 10px 18px; min-width: 120px;">10% DP</button>
                    <button type="button" class="swal2-styled" data-selection="reservation20" style="background-color: #e67700; padding: 10px 18px; min-width: 120px;">20% DP</button>
                  </div>
                </div>
              `,
              icon: 'question',
              showConfirmButton: false,
              showDenyButton: false,
              showCancelButton: false,
              showCloseButton: true,
              width: '640px',
              allowOutsideClick: false,
              customClass: {
                popup: 'swal-wide',
              },
              didOpen: () => {
                const container = Swal.getHtmlContainer();
                container
                  ?.querySelectorAll<HTMLButtonElement>('[data-selection]')
                  .forEach((button) => {
                    button.addEventListener('click', () => {
                      resolved = true;
                      resolve(button.dataset.selection as InvoiceSelection);
                      Swal.close();
                    });
                  });
              },
              willClose: () => {
                if (!resolved) {
                  resolve(null);
                }
              },
            });
          }
        );

        if (selection === 'inTransit') {
          await handleInTransitInvoiceGeneration(visibleTransactions);
          return;
        }

        if (selection === 'reservation10') {
          await handleReservationInvoiceGeneration(visibleTransactions);
          return;
        }

        if (selection === 'reservation20') {
          await handleTwentyPercentReservationInvoiceGeneration(
            visibleTransactions
          );
          return;
        }

        if (selection !== 'onhand') {
          showNotification({
            title: '✅ Invoice Generation Cancelled',
            message: 'No changes were made.',
            color: 'blue',
            autoClose: 4000,
          });
          return;
        }

        const invoiceType = 'Onhand' as const;
        logger.debug('📄 Invoice type selected: Onhand');

        const warehouseTransactions = visibleTransactions.filter(
          (t) => getNormalizedStatus(t['Order Status']) === 'warehouse'
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
              t.Customers === customerName &&
              getNormalizedStatus(t['Order Status']) === 'warehouse'
          );
          const customerPrepared = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName &&
              getNormalizedStatus(t['Order Status']) === 'prepared'
          );
          const customerOnHold = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName &&
              getNormalizedStatus(t['Order Status']) === 'on-hold'
          );

          totalWarehouse += customerWarehouse.length;
          totalPrepared += customerPrepared.length;
          totalOnHold += customerOnHold.length;
        });

        const totalTransactions = totalWarehouse + totalPrepared + totalOnHold;

        // Show SweetAlert2 confirmation dialog
        const result = await Swal.fire({
          title: 'Onhand Invoice Confirmation',
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 12px; font-weight: 500;">
                You are about to generate Onhand invoices for:
              </p>
              <div style="margin-bottom: 16px;">
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${customersWithWarehouse.size}</strong> customer${customersWithWarehouse.size === 1 ? '' : 's'}
                </p>
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${totalWarehouse}</strong> Warehouse order${totalWarehouse === 1 ? '' : 's'}
                </p>
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${totalPrepared}</strong> Prepared order${totalPrepared === 1 ? '' : 's'}
                </p>
                <p style="margin: 6px 0; font-size: 14px;">
                  <strong>${totalOnHold}</strong> On-Hold order${totalOnHold === 1 ? '' : 's'}
                </p>
                <p style="margin: 6px 0; font-size: 14px;">
                  Total transactions: <strong>${totalTransactions}</strong>
                </p>
              </div>

              <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

              <p style="margin-bottom: 12px; font-weight: 500;">Important Details:</p>
              <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #495057;">
                <li>Only customers with Warehouse orders are included in this run</li>
                <li>${totalWarehouse} Warehouse order${totalWarehouse === 1 ? ' will' : 's will'} be upgraded to <strong>Prepared</strong></li>
                <li>New invoice dates will be assigned where missing</li>
                <li>A consolidated invoice file will download automatically</li>
              </ul>

              <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

              <p style="text-align: center; color: #868e96; font-size: 14px; margin: 0;">
                Do you want to proceed with Onhand invoice generation?
              </p>
            </div>
          `,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Generate Onhand Invoices',
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
              t.Customers === customerName &&
              getNormalizedStatus(t['Order Status']) === 'warehouse'
          );
          const customerPrepared = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName &&
              getNormalizedStatus(t['Order Status']) === 'prepared'
          );
          const customerOnHold = visibleTransactions.filter(
            (t) =>
              t.Customers === customerName &&
              getNormalizedStatus(t['Order Status']) === 'on-hold'
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
            invoiceType,
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
            message: `${fileType} for ${statusSummary} orders from ${customersWithWarehouse.size} customer${customersWithWarehouse.size > 1 ? 's' : ''} downloaded as ${invoiceType} invoices.${statusUpdateMessage}`,
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

            if (
              processedIds.has(t.id) &&
              getNormalizedStatus(t['Order Status']) === 'warehouse'
            ) {
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
            // ==================================================================
            // ⚠️ SAVE RESILIENCE
            // ==================================================================
            // Persist updates and surface partial failures without breaking the
            // user workflow. Encourage refresh if any writes fail.
            // ==================================================================
            const results = await Promise.allSettled(
              toSave.map((t) => saveTransactionToDatabase(t))
            );
            const failed = results.filter(
              (result) => result.status === 'rejected'
            );

            if (failed.length > 0) {
              logger.warn('Partial invoice update save failure', {
                failed: failed.length,
                total: results.length,
              });
              showNotification({
                title: '⚠️ Some Invoice Updates Failed to Save',
                message:
                  'Some records did not persist to the database. Please refresh and retry if needed.',
                color: 'yellow',
                autoClose: 8000,
              });
            }
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
    [
      transactions,
      bulkUpdate,
      saveTransactionToDatabase,
      handleInTransitInvoiceGeneration,
      handleReservationInvoiceGeneration,
      handleTwentyPercentReservationInvoiceGeneration,
    ]
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
        const status = getNormalizedStatus(t['Order Status']);
        return status === 'prepared';
      });

      // Customers with at least one Prepared order ≤ ₱50.00
      const customersWithEligiblePrepared = new Set(
        visibleTransactions
          .filter((t) => {
            const status = getNormalizedStatus(t['Order Status']);
            const lineTotal = Number(t['Line Total']) || 0;
            return status === 'prepared' && lineTotal <= 50.0;
          })
          .map((t) => t.Customers)
          .filter(Boolean)
      );

      // Final eligible set: Prepared ≤ ₱50.00 plus On-Hold for customers who also have Prepared
      const eligible = visibleTransactions.filter((t) => {
        const status = getNormalizedStatus(t['Order Status']);
        const customerName = t.Customers;
        const lineTotal = Number(t['Line Total']) || 0;

        // Always apply original Prepared ≤ ₱50 rule
        if (status === 'prepared' && lineTotal <= 50.0) {
          return true;
        }

        // Include On-Hold only if this customer has at least one Prepared order ≤ ₱50.00
        if (
          status === 'on-hold' &&
          customerName &&
          customersWithEligiblePrepared.has(customerName)
        ) {
          return true;
        }

        return false;
      });

      let filteredEligible = eligible;

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

        const splitWarningResult = await Swal.fire({
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
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: 'Proceed',
          denyButtonText: 'Skip These Customers',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#60bd52ff',
          denyButtonColor: '#5198dfff',
          cancelButtonColor: '#ff7171ff',
          width: '813px',
          allowOutsideClick: false,
          customClass: {
            popup: 'swal-wide',
          },
        });

        if (splitWarningResult.isDenied) {
          const splitCustomerNames = new Set(
            customersWithSplitOrders.map((c) => c.customerName)
          );

          filteredEligible = filteredEligible.filter((t) => {
            const customerKey = t.Customers || 'Unknown';
            return !splitCustomerNames.has(customerKey);
          });

          if (filteredEligible.length === 0) {
            showNotification({
              title: '⚠️ No Eligible Transactions',
              message:
                'All split-order customers were skipped. No transactions left to process.',
              color: 'yellow',
              autoClose: 5000,
            });
            return;
          }

          showNotification({
            title: 'ℹ️ Split Customers Skipped',
            message:
              'Customers with split orders were excluded from this packing list.',
            color: 'blue',
            autoClose: 5000,
          });
        } else if (
          splitWarningResult.dismiss === Swal.DismissReason.cancel ||
          splitWarningResult.dismiss === Swal.DismissReason.close
        ) {
          showNotification({
            title: '✅ Packing List Generation Cancelled',
            message: 'No changes were made.',
            color: 'blue',
            autoClose: 4000,
          });
          return;
        }
      }

      const escapeHtml = (value: string): string =>
        value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

      const uniqueCustomers = new Set(
        filteredEligible.map((t) => t.Customers?.trim()).filter(Boolean)
      );

      const customerList = Array.from(uniqueCustomers).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );

      const customersHtml =
        customerList.length > 0
          ? customerList
              .map((customer) => `<li>${escapeHtml(customer)}</li>`)
              .join('')
          : '<li><em>No customers found</em></li>';
      const totalValue = filteredEligible.reduce(
        (sum, t) => sum + (Number(t['Line Total']) || 0),
        0
      );

      // Counts by status for clearer confirmation messaging
      const preparedCount = filteredEligible.filter(
        (t) => getNormalizedStatus(t['Order Status']) === 'prepared'
      ).length;
      const onHoldCount = filteredEligible.filter(
        (t) => getNormalizedStatus(t['Order Status']) === 'on-hold'
      ).length;

      // Show SweetAlert2 confirmation dialog
      const result = await Swal.fire({
        title: 'Packing List Generation Confirmation',
        html: `
          <div style="text-align: left;">
            <p style="font-weight: 500; margin-bottom: 12px;">You are about to generate packing lists for:</p>
            
            <div style="margin-bottom: 16px;">
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${filteredEligible.length}</strong> eligible transactions
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

            <p style="font-weight: 500; margin-bottom: 12px;">Customers:</p>
            <div style="max-height: 160px; overflow: auto; border: 1px solid #dee2e6; border-radius: 12px; padding: 10px; background: #f8f9fa;">
              <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #495057;">
                ${customersHtml}
              </ul>
            </div>

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
        const transformed = filteredEligible.map((t) => ({
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
            message: `PDF with packing lists for ${filteredEligible.length} transactions downloaded`,
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
                  type CustomerRecord = {
                    id: number;
                    customerName: string;
                    businessName: string;
                    shopeeUsernames: string[];
                  };

                  const customersData = (await customersResponse.json()) as {
                    success: boolean;
                    data: CustomerRecord[] | { customers: CustomerRecord[] };
                  };

                  const customersPayload = Array.isArray(customersData.data)
                    ? customersData.data
                    : customersData.data.customers;

                  logger.info('Customers with Shopee data received:', {
                    success: customersData.success,
                    totalCustomers: customersPayload.length,
                  });

                  // Step 3: Match dispatch usernames to customer names
                  dispatchUsernames.forEach((username) => {
                    const normalizedUsername = username.toLowerCase().trim();
                    const matchedCustomer = customersPayload.find((customer) =>
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

          const processedIds = new Set(filteredEligible.map((t) => t.id));
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

              const remainingBalance = Number(t['Line Total']) || 0;

              // Business rule:
              // - Paid/shipping statuses imply FULLY paid.
              // - If we ship before payment, use "Pending Payment".
              const orderStatus =
                remainingBalance > 0
                  ? 'Pending Payment'
                  : isInDispatch
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
            // ==================================================================
            // ⚠️ SAVE RESILIENCE
            // ==================================================================
            // Persist updates and surface partial failures without breaking the
            // user workflow. Encourage refresh if any writes fail.
            // ==================================================================
            const results = await Promise.allSettled(
              toSave.map((t) => saveTransactionToDatabase(t))
            );
            const failed = results.filter(
              (result) => result.status === 'rejected'
            );

            if (failed.length > 0) {
              logger.warn('Partial packing list update save failure', {
                failed: failed.length,
                total: results.length,
              });
              showNotification({
                title: '⚠️ Some Packing List Updates Failed to Save',
                message:
                  'Some records did not persist to the database. Please refresh and retry if needed.',
                color: 'yellow',
                autoClose: 8000,
              });
            }
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
      const warehouse = visibleTransactions.filter((t) => {
        const status = getNormalizedStatus(t['Order Status']);
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
      const warehouse = pendingDistributionData.filter((t) => {
        const status = getNormalizedStatus(t['Order Status']);
        return status === 'warehouse' || status === 'prepared';
      });

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
    generateTwentyPercentReservationInvoices:
      handleTwentyPercentReservationInvoiceGeneration,

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

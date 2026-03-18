'use client';

import { useCallback, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import { TransactionService } from '../services/TransactionService';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
import type { TransactionData } from '../types/transaction.types';

interface UseInvoiceGenerationProps {
  transactions: TransactionData[];
  bulkUpdate: (data: TransactionData[]) => void;
  apiBasePath?: string;
  customerLookupBasePath?: string;
  saveTransactionToDatabase: (transaction: TransactionData) => Promise<unknown>;
}

interface UseInvoiceGenerationReturn {
  isGeneratingInvoice: boolean;
  prepareInvoiceGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  generateTwentyPercentReservationInvoices: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
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

export function useInvoiceGeneration(
  props: UseInvoiceGenerationProps
): UseInvoiceGenerationReturn {
  const {
    transactions,
    bulkUpdate,
    apiBasePath,
    customerLookupBasePath,
    saveTransactionToDatabase,
  } = props;

  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const getNormalizedStatus = (value: string | null | undefined) =>
    normalizeOrderStatus(value);

  const handleInTransitInvoiceGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      const Swal = await getSwal();
      logger.debug('🚚 Preparing In Transit invoice generation...');

      const inTransitTransactions = visibleTransactions.filter(
        (transaction) =>
          getNormalizedStatus(transaction['Order Status']) === 'in transit'
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
        inTransitTransactions
          .map((transaction) => transaction.Customers)
          .filter(Boolean)
      );

      const totalValue = inTransitTransactions.reduce(
        (sum, transaction) => sum + (Number(transaction['Line Total']) || 0),
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
          customersData = await api.get<Record<string, unknown>[]>(
            buildApiPath(customerLookupBasePath, '/customers')
          );
        } catch {
          logger.warn('Failed to fetch customers data for In Transit invoices');
        }

        const response = await fetch(
          buildApiPath(apiBasePath, '/generate-in-transit-invoice'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactions: inTransitTransactions,
              customers: customersData,
            }),
          }
        );

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
    [apiBasePath, customerLookupBasePath]
  );

  const runReservationInvoiceWorkflow = useCallback(
    async (
      visibleTransactions: TransactionData[],
      config: ReservationInvoiceWorkflowConfig
    ) => {
      const Swal = await getSwal();
      const percentLabel = `${Math.round(config.feePercentage * 100)}%`;
      logger.debug(
        `💳 Preparing reservation-fee invoice generation (${percentLabel})...`
      );

      const reservationTransactions = visibleTransactions.filter(
        (transaction) =>
          getNormalizedStatus(transaction['Order Status']) === 'in transit' &&
          (Number(transaction.Adjustment) === 0 || !transaction.Adjustment)
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
        reservationTransactions
          .map((transaction) => transaction.Customers)
          .filter(Boolean)
      );

      const totalValue = reservationTransactions.reduce(
        (sum, transaction) => sum + (Number(transaction['Line Total']) || 0),
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
          customersData = await api.get<Record<string, unknown>[]>(
            buildApiPath(customerLookupBasePath, '/customers')
          );
        } catch {
          logger.warn(
            'Failed to fetch customers data for reservation invoices'
          );
        }

        const response = await fetch(
          buildApiPath(apiBasePath, '/generate-invoice'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactions: reservationTransactions,
              customers: customersData,
              invoiceType: config.invoiceType,
            }),
          }
        );

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
    [apiBasePath, customerLookupBasePath]
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

  const prepareInvoiceGeneration = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      const Swal = await getSwal();
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
          (transaction) =>
            getNormalizedStatus(transaction['Order Status']) === 'warehouse'
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
          warehouseTransactions
            .map((transaction) => transaction.Customers)
            .filter(Boolean)
        );

        let totalWarehouse = 0;
        let totalPrepared = 0;
        let totalOnHold = 0;

        customersWithWarehouse.forEach((customerName) => {
          const customerWarehouse = visibleTransactions.filter(
            (transaction) =>
              transaction.Customers === customerName &&
              getNormalizedStatus(transaction['Order Status']) === 'warehouse'
          );
          const customerPrepared = visibleTransactions.filter(
            (transaction) =>
              transaction.Customers === customerName &&
              getNormalizedStatus(transaction['Order Status']) === 'prepared'
          );
          const customerOnHold = visibleTransactions.filter(
            (transaction) =>
              transaction.Customers === customerName &&
              getNormalizedStatus(transaction['Order Status']) === 'on-hold'
          );

          totalWarehouse += customerWarehouse.length;
          totalPrepared += customerPrepared.length;
          totalOnHold += customerOnHold.length;
        });

        const totalTransactions = totalWarehouse + totalPrepared + totalOnHold;

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

        logger.debug(
          '📄 User confirmed - proceeding with invoice generation...'
        );
        setIsGeneratingInvoice(true);

        const invoiceTransactions: TransactionData[] = [];
        customersWithWarehouse.forEach((customerName) => {
          const customerWarehouse = visibleTransactions.filter(
            (transaction) =>
              transaction.Customers === customerName &&
              getNormalizedStatus(transaction['Order Status']) === 'warehouse'
          );
          const customerPrepared = visibleTransactions.filter(
            (transaction) =>
              transaction.Customers === customerName &&
              getNormalizedStatus(transaction['Order Status']) === 'prepared'
          );
          const customerOnHold = visibleTransactions.filter(
            (transaction) =>
              transaction.Customers === customerName &&
              getNormalizedStatus(transaction['Order Status']) === 'on-hold'
          );

          invoiceTransactions.push(
            ...customerWarehouse,
            ...customerPrepared,
            ...customerOnHold
          );
        });

        let customersData: Record<string, unknown>[] = [];
        try {
          customersData = await api.get<Record<string, unknown>[]>(
            buildApiPath(customerLookupBasePath, '/customers')
          );
        } catch {
          logger.warn('Failed to fetch customers data');
        }

        const response = await fetch(
          buildApiPath(apiBasePath, '/generate-invoice'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactions: invoiceTransactions,
              customers: customersData,
              invoiceType,
            }),
          }
        );

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;

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
              filename = decodeURIComponent(filename);
            }
          }

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

          const currentDateISO = new Date().toISOString();

          const processedIds = new Set(
            invoiceTransactions.map((transaction) => transaction.id)
          );

          const updatedTransactions = transactions.map((transaction) => {
            const updates: Partial<TransactionData> = {};
            let hasUpdates = false;

            if (
              processedIds.has(transaction.id) &&
              (!transaction['Invoice Date'] ||
                transaction['Invoice Date'].trim() === '')
            ) {
              updates['Invoice Date'] = currentDateISO;
              hasUpdates = true;
            }

            if (
              processedIds.has(transaction.id) &&
              getNormalizedStatus(transaction['Order Status']) === 'warehouse'
            ) {
              updates['Order Status'] = 'Prepared';
              hasUpdates = true;
            }

            return hasUpdates ? { ...transaction, ...updates } : transaction;
          });

          const toSave = updatedTransactions.filter(
            (transaction) =>
              processedIds.has(transaction.id) && transaction.id !== undefined
          );

          if (toSave.length > 0) {
            bulkUpdate(TransactionService.sanitizeTransactions(toSave));
          }

          if (toSave.length > 0) {
            const results = await Promise.allSettled(
              toSave.map((transaction) =>
                saveTransactionToDatabase(transaction)
              )
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
      apiBasePath,
      customerLookupBasePath,
    ]
  );

  return {
    isGeneratingInvoice,
    prepareInvoiceGeneration,
    generateTwentyPercentReservationInvoices:
      handleTwentyPercentReservationInvoiceGeneration,
  };
}

import type { handleQuantityColumnEdit } from './transactionQuantityColumnHandler';
import { getCellValue } from './transactionCellValueUtils';
import { TransactionService } from '../services/TransactionService';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { showConfirm } from '@/lib/alerts';

type ProductColumnParams = Omit<
  Parameters<typeof handleQuantityColumnEdit>[0],
  'columnId' | 'formatNumberValue'
> & {
  productToShipmentMap: Record<string, string>;
  productToShipmentStatusMap: Record<string, string>;
};

export async function handleProductCodeColumnEdit({
  rawValue: newValue,
  transaction,
  transactionDescriptor,
  shouldLog,
  apiBasePath,
  isBatchMode: isBatchEdit,
  priceTiers,
  getCurrentTransaction,
  updateTransactionData,
  notify,
  logNotification,
  formatCurrencyValue,
  fireAlert,
  productToShipmentMap,
  productToShipmentStatusMap,
}: ProductColumnParams) {
  const Swal = { fire: fireAlert };

  const dropdownValue = getCellValue(newValue);
  const isBundleSku = dropdownValue.trim().toLowerCase().startsWith('bundle');

  // =====================================================================
  // 🛡️ STOCK CHECK - Prevent overselling
  // Only check if:
  // 1. Product code is not empty
  // 2. Transaction has no ID (new row) OR is being created
  // 3. Not in batch mode (skip during paste operations)
  // =====================================================================
  if (dropdownValue && dropdownValue.trim() !== '' && !isBatchEdit) {
    try {
      const currentQuantity = getCurrentTransaction().Quantity ?? 0;

      // If Quantity is not set yet, don't block SKU selection.
      // Stock will be validated when Quantity is entered/changed.
      if (currentQuantity > 0) {
        const stockResponse = await fetch(
          buildApiPath(apiBasePath, '/inventory/check-stock'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              productCode: dropdownValue.trim(),
              requestedQuantity: currentQuantity,
            }),
          }
        );

        if (stockResponse.ok) {
          const stockInfo = (await stockResponse.json()) as {
            status: string;
            message: string;
            availableStock: number;
            canFulfill: boolean;
          };

          // f534 SOLD OUT - Block order creation
          if (stockInfo.status === 'SOLD_OUT') {
            await Swal.fire({
              icon: 'error',
              title: 'f534 Insufficient Quantity!',
              text: stockInfo.message,
              confirmButtonText: 'OK',
              confirmButtonColor: '#fa5252',
              allowOutsideClick: false,
            });
            logger.warn(`Stock check failed for ${dropdownValue}:`, stockInfo);
            return;
          }

          // f534 INSUFFICIENT STOCK - Offer to cap quantity to what's available
          if (stockInfo.status === 'INSUFFICIENT_STOCK') {
            const available = Number(stockInfo.availableStock || 0);
            if (available > 0) {
              const result = await Swal.fire({
                icon: 'warning',
                title: 'f534 Insufficient Quantity!',
                text: `${stockInfo.message}\n\nUse available quantity (${available}) to sell out?`,
                showCancelButton: true,
                confirmButtonText: `Use ${available}`,
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#fab005',
                cancelButtonColor: '#adb5bd',
                allowOutsideClick: false,
              });

              if (result.isConfirmed) {
                await updateTransactionData({ Quantity: available });
              } else {
                return;
              }
            } else {
              await Swal.fire({
                icon: 'error',
                title: 'f534 Insufficient Quantity!',
                text: stockInfo.message,
                confirmButtonText: 'OK',
                confirmButtonColor: '#fa5252',
                allowOutsideClick: false,
              });
              logger.warn(
                `Stock check failed for ${dropdownValue}:`,
                stockInfo
              );
              return;
            }
          }

          // f7e1 LOW STOCK - Show warning but allow order
          if (stockInfo.status === 'LOW_STOCK') {
            await Swal.fire({
              icon: 'warning',
              title: 'f7e1 Low Stock Warning',
              text: stockInfo.message,
              confirmButtonText: 'OK',
              confirmButtonColor: '#fab005',
              allowOutsideClick: false,
            });
            logger.info(`Low stock warning for ${dropdownValue}:`, stockInfo);
          }
        }
      }
    } catch (error) {
      logger.error('Stock check failed:', error);
      // Continue with order creation on error (fail-safe)
    }
  }

  // Auto-populate shipment code
  const correspondingShipmentCode = productToShipmentMap[dropdownValue] || '';
  const correspondingShipmentStatus =
    productToShipmentStatusMap[dropdownValue] || '';

  // Auto-populate order status (only if blank or "In Transit")
  const currentOrderStatus = transaction['Order Status'] || '';
  const shouldAutoPopulateStatus =
    currentOrderStatus === '' ||
    currentOrderStatus.toLowerCase() === 'in transit';

  let finalOrderStatus = currentOrderStatus;

  if (
    shouldAutoPopulateStatus &&
    dropdownValue &&
    dropdownValue.trim() !== ''
  ) {
    if (correspondingShipmentStatus !== '') {
      // Has shipment status - map to order status
      finalOrderStatus = TransactionService.getOrderStatusFromShipmentStatus(
        correspondingShipmentStatus
      );
    } else {
      // No shipment status yet - bundles are on-hand, others default to "In Transit"
      finalOrderStatus = isBundleSku ? 'Warehouse' : 'In Transit';
    }
  }

  // Handle clearing Product Code
  if (!dropdownValue || dropdownValue.trim() === '') {
    if (
      currentOrderStatus.toLowerCase() === 'in transit' ||
      currentOrderStatus.toLowerCase() === 'warehouse'
    ) {
      finalOrderStatus = '';
    } else if (
      currentOrderStatus &&
      currentOrderStatus.trim() !== '' &&
      currentOrderStatus.toLowerCase() !== 'prepared'
    ) {
      // Show confirmation for important statuses
      const shouldClear = await showConfirm({
        title: '⚠️ CONFIRMATION REQUIRED',
        message:
          `You are about to clear the Product Code for a transaction with Order Status: "${currentOrderStatus}"\n\n` +
          `This is an important status that may indicate:\n` +
          `• Order is in advanced processing stage\n` +
          `• Customer has been notified\n` +
          `• Business processes may be affected\n\n` +
          `Do you want to continue clearing the Product Code?\n\n` +
          `• Click Yes to clear Product Code and preserve Order Status\n` +
          `• Click No to keep both Product Code and Order Status unchanged`,
        type: 'warning',
        confirmButtonText: 'Yes, Clear Product Code',
        cancelButtonText: 'No, Keep Both',
      });

      if (!shouldClear) {
        notify({
          title: '✅ Action Cancelled',
          message: `Product Code clearing cancelled. Order Status "${currentOrderStatus}" preserved.`,
          color: 'blue',
          autoClose: 4000,
        });
        return;
      }
    }
  }

  // ⚠️ FINALIZED: Unit Price auto-population
  const currentQuantity = transaction.Quantity || 0;
  const currentDiscount = transaction.Discount || 0;
  const currentAdjustment = transaction.Adjustment || 0;
  let autoPopulatedUnitPrice = 0;
  let unitPriceAutoPopulated = false;
  let unitPriceCleared = false;

  if (!dropdownValue || dropdownValue.trim() === '') {
    unitPriceCleared = true;
  } else if (dropdownValue && currentQuantity > 0) {
    autoPopulatedUnitPrice = TransactionService.calculateUnitPrice(
      dropdownValue,
      currentQuantity,
      currentDiscount,
      priceTiers
    );
    unitPriceAutoPopulated = autoPopulatedUnitPrice > 0;
  }

  // Always recalculate line total so field order (qty first, product later) stays consistent
  const recalculatedLineTotal = TransactionService.calculateLineTotal(
    currentQuantity,
    autoPopulatedUnitPrice,
    currentAdjustment
  );

  const updatedTransaction = {
    ...transaction,
    'Product Code': dropdownValue,
    'Shipment Code': correspondingShipmentCode,
    'Order Status': finalOrderStatus,
    'Unit Price': autoPopulatedUnitPrice,
    'Line Total': recalculatedLineTotal,
  };

  updateTransactionData(updatedTransaction);

  // Build notification message
  let message = 'Product Code updated successfully';
  const autopopulated: string[] = [];
  if (correspondingShipmentCode) {
    autopopulated.push('Shipment Code');
  }
  if (shouldAutoPopulateStatus && finalOrderStatus !== currentOrderStatus) {
    autopopulated.push('Order Status');
  }
  if (unitPriceAutoPopulated) {
    autopopulated.push('Unit Price');
  }
  if (recalculatedLineTotal !== (transaction['Line Total'] ?? 0)) {
    autopopulated.push('Line Total');
  }

  if (autopopulated.length > 0) {
    message += ` and ${autopopulated.join(' & ')} auto-populated`;
  }
  if (unitPriceCleared) {
    message += ' (Unit Price cleared)';
  }

  notify({ title: 'Success', message, color: 'green' });

  if (shouldLog) {
    const previousProduct =
      transaction['Product Code'] && transaction['Product Code'].trim() !== ''
        ? transaction['Product Code'].trim()
        : 'No product';
    const nextProduct =
      dropdownValue && dropdownValue.trim() !== ''
        ? dropdownValue.trim()
        : 'No product';

    const updates: string[] = [];

    if (previousProduct !== nextProduct) {
      updates.push(`Product Code from ${previousProduct} to ${nextProduct}`);
    }

    if (
      correspondingShipmentCode &&
      correspondingShipmentCode !== transaction['Shipment Code']
    ) {
      updates.push(`Shipment Code → ${correspondingShipmentCode}`);
    }

    if (
      shouldAutoPopulateStatus &&
      finalOrderStatus !== (transaction['Order Status'] ?? '') &&
      finalOrderStatus
    ) {
      updates.push(`Order Status → ${finalOrderStatus}`);
    }

    if (unitPriceAutoPopulated) {
      updates.push(
        `Unit Price → ${formatCurrencyValue(autoPopulatedUnitPrice)}`
      );
    }

    if (unitPriceCleared) {
      updates.push('Unit Price cleared');
    }

    if (recalculatedLineTotal !== (transaction['Line Total'] ?? 0)) {
      updates.push(
        `Line Total → ${formatCurrencyValue(recalculatedLineTotal)}`
      );
    }

    const updateSummary =
      updates.length > 0 ? updates.join('; ') : 'No dependent fields changed';

    logNotification(
      `Product details updated for ${transactionDescriptor}. ${updateSummary}.`,
      {
        column: 'Product Code',
        transactionId: transaction.id,
        previousValue: transaction['Product Code'] ?? '',
        newValue: dropdownValue,
        shipmentCode: correspondingShipmentCode || null,
        orderStatus: finalOrderStatus,
        unitPrice: unitPriceAutoPopulated
          ? autoPopulatedUnitPrice
          : (transaction['Unit Price'] ?? 0),
      }
    );
  }
}

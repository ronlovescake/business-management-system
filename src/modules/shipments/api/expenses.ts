import type { ExpenseCreateInput } from '@/modules/clothing/employees/expenses/api/schemas';
import { expenseService } from '@/modules/clothing/employees/expenses/api/service';
import type { ShipmentDB } from '@/types';
import { logger } from '@/lib/logger';

function isDelivered(status?: string | null): boolean {
  return (status ?? '').trim().toLowerCase() === 'delivered';
}

function buildExpenseFromShipment(
  shipment: ShipmentDB
): (ExpenseCreateInput & { sourceId: string }) | null {
  if (!isDelivered(shipment.shipmentStatus)) {
    return null;
  }

  const amount = Number(shipment.fee ?? 0);
  if (!amount || amount <= 0) {
    return null;
  }

  const dateString = shipment.dateDelivered || shipment.dateCreated;
  const date = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const descriptionParts = [
    shipment.shipmentCode,
    shipment.cvNumber && `CV: ${shipment.cvNumber}`,
    `Sacks: ${shipment.noOfSacks ?? ''}`,
    `CBM: ${shipment.totalCBM ?? ''}`,
    `Weight: ${shipment.weight ?? ''}`,
  ].filter(Boolean);

  const sourceLineKey =
    shipment.shipmentCode || shipment.cvNumber || String(shipment.id);

  return {
    date,
    amount,
    description: descriptionParts.join(' | '),
    category: 'Shipping / Delivery Fee',
    notes: shipment.notes ?? undefined,
    receipt: null,
    status: 'pending',
    employeeName: undefined,
    paymentMethod: undefined,
    paymentCardId: undefined,
    sourceType: 'SHIPMENT',
    sourceId: String(shipment.id),
    sourceLineKey,
    systemGenerated: true,
  };
}

export async function postExpenseForShipment(shipment: ShipmentDB) {
  const expensePayload = buildExpenseFromShipment(shipment);
  if (!expensePayload) {
    logger.debug('Skip expense post for shipment', {
      shipmentId: shipment.id,
      shipmentStatus: shipment.shipmentStatus,
      amount: shipment.fee,
    });
    return;
  }

  try {
    const expense = await expenseService.upsertBySource(expensePayload);
    logger.info('Expense posted from shipment', {
      shipmentId: shipment.id,
      expenseId: expense.id,
      sourceLineKey: expense.sourceLineKey,
    });
  } catch (error) {
    logger.warn('Failed to post expense for shipment', {
      error,
      shipmentId: shipment.id,
      shipmentCode: shipment.shipmentCode,
    });
  }
}

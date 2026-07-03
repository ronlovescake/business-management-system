import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { logger } from '@/lib/logger';
import type { ShipmentDB } from '@/types';
import {
  convertShipmentDBToData,
  convertShipmentDataToDB,
  getOrderStatusFromShipmentStatus,
  parseShipmentId,
} from './shipmentUtils';

type RouteContext = { params: { id: string } };
type ShipmentWriteData = ReturnType<typeof convertShipmentDataToDB>;

type ShipmentFindUniqueArgs = { where: { id: number } };
type ShipmentUpdateArgs = { where: { id: number }; data: ShipmentWriteData };
type ShipmentDeleteArgs = { where: { id: number } };
type ProductFindManyArgs = {
  where: { shipmentCode: string };
  select: { productCode: true };
};
type ProductUpdateManyArgs = {
  where: { shipmentCode: string };
  data: Pick<
    ShipmentWriteData,
    'cvNumber' | 'noOfSacks' | 'totalCBM' | 'weight' | 'shipmentStatus'
  >;
};
type TransactionUpdateManyArgs = {
  where: {
    deletedAt: null;
    AND: Array<{
      OR: Array<
        | { shipmentCode: string }
        | { productCode: { in: string[] } }
        | { orderStatus: null }
        | { orderStatus: '' }
        | { orderStatus: { equals: string; mode: 'insensitive' } }
      >;
    }>;
  };
  data: { orderStatus: string };
};

/**
 * Prisma delegate for shipment detail routes.
 * Each domain binds its own shipment, product, and transaction models.
 */
export interface ShipmentDetailDelegates {
  shipmentModel: {
    findUnique: (args: ShipmentFindUniqueArgs) => Promise<ShipmentDB | null>;
    update: (args: ShipmentUpdateArgs) => Promise<ShipmentDB>;
    delete?: (args: ShipmentDeleteArgs) => Promise<unknown>;
  };
  productModel: {
    findMany: (
      args: ProductFindManyArgs
    ) => Promise<Array<{ productCode?: string | null }>>;
    updateMany: (args: ProductUpdateManyArgs) => Promise<unknown>;
  };
  transactionModel?: {
    updateMany: (args: TransactionUpdateManyArgs) => Promise<{ count: number }>;
  };
  /** If provided, called after create/update to post expense entries. */
  postExpenseForShipment?: (shipment: ShipmentDB) => Promise<void>;
  /** Whether DELETE is supported on [id] route. */
  enableDelete?: boolean;
  /** Domain label for logging (e.g. "GM"). */
  domainLabel?: string;
}

export function createShipmentDetailRoutes(delegates: ShipmentDetailDelegates) {
  const label = delegates.domainLabel ?? '';

  const GET = withErrorHandler<RouteContext>(
    async (_request: NextRequest, context) => {
      const idResult = parseShipmentId(context);
      if ('error' in idResult) {
        return idResult.error;
      }

      const shipment = await delegates.shipmentModel.findUnique({
        where: { id: idResult.id },
      });

      if (!shipment) {
        return ApiResponse.notFound('Shipment');
      }

      const converted = convertShipmentDBToData(shipment);
      return ApiResponse.success(converted, 'Shipment fetched');
    }
  );

  const PUT = withErrorHandler<RouteContext>(
    async (request: NextRequest, context) => {
      const idResult = parseShipmentId(context);
      if ('error' in idResult) {
        return idResult.error;
      }

      const body = await request.json();
      const shipmentData = convertShipmentDataToDB(body);

      const currentShipment = await delegates.shipmentModel.findUnique({
        where: { id: idResult.id },
      });

      if (!currentShipment) {
        return ApiResponse.notFound('Shipment');
      }

      const updatedShipment = await delegates.shipmentModel.update({
        where: { id: idResult.id },
        data: shipmentData,
      });

      if (currentShipment.shipmentCode) {
        await delegates.productModel.updateMany({
          where: { shipmentCode: currentShipment.shipmentCode },
          data: {
            cvNumber: shipmentData.cvNumber,
            noOfSacks: shipmentData.noOfSacks,
            totalCBM: shipmentData.totalCBM,
            weight: shipmentData.weight,
            shipmentStatus: shipmentData.shipmentStatus,
          },
        });

        logger.debug(
          `${label ? label + ' ' : ''}Updated products with shipment code: ${currentShipment.shipmentCode}`,
          `Updated fields: cvNumber, noOfSacks, totalCBM, weight, shipmentStatus`
        );

        // Keep Transactions order status in sync with Shipment status.
        if (delegates.transactionModel) {
          const nextOrderStatus = getOrderStatusFromShipmentStatus(
            shipmentData.shipmentStatus
          );

          const productsForShipment = await delegates.productModel.findMany({
            where: { shipmentCode: currentShipment.shipmentCode },
            select: { productCode: true },
          });

          const productCodes = productsForShipment
            .map((p) => p.productCode)
            .filter((code): code is string => Boolean(code));

          const updateResult = await delegates.transactionModel.updateMany({
            where: {
              deletedAt: null,
              AND: [
                {
                  OR: [
                    { shipmentCode: currentShipment.shipmentCode },
                    ...(productCodes.length > 0
                      ? [{ productCode: { in: productCodes } }]
                      : []),
                  ],
                },
                {
                  OR: [
                    { orderStatus: null },
                    { orderStatus: '' },
                    {
                      orderStatus: {
                        equals: 'In Transit',
                        mode: 'insensitive',
                      },
                    },
                    {
                      orderStatus: {
                        equals: 'Warehouse',
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              ],
            },
            data: { orderStatus: nextOrderStatus },
          });

          if (updateResult.count > 0) {
            logger.info(
              `${label ? label + ' s' : 'S'}ynced transaction orderStatus from shipment status`,
              {
                shipmentCode: currentShipment.shipmentCode,
                shipmentStatus: shipmentData.shipmentStatus,
                orderStatus: nextOrderStatus,
                updatedCount: updateResult.count,
              }
            );
          }
        }
      }

      if (delegates.postExpenseForShipment) {
        await delegates.postExpenseForShipment(updatedShipment);
      }

      const converted = convertShipmentDBToData(updatedShipment);
      return ApiResponse.success(converted, 'Shipment updated');
    }
  );

  const DELETE =
    delegates.enableDelete !== false
      ? withErrorHandler<RouteContext>(
          async (_request: NextRequest, context) => {
            const idResult = parseShipmentId(context);
            if ('error' in idResult) {
              return idResult.error;
            }

            if (!delegates.shipmentModel.delete) {
              return ApiResponse.error('Delete not supported');
            }

            await delegates.shipmentModel.delete({
              where: { id: idResult.id },
            });

            return ApiResponse.success(
              { id: idResult.id },
              'Shipment deleted successfully'
            );
          }
        )
      : undefined;

  return { GET, PUT, DELETE };
}

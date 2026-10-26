import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  FinancialOperationError,
  runFinancialRequest,
} from './financial-transactions';
import { getRuntimeAccountingCutoverDate } from './cutover';
import {
  INVENTORY_ASSET_BUCKETS,
  pickMovementDate,
  pickUnitCostFromProductRow,
} from './inventoryCogsShared';
import { dayjs, getCurrentDateISO, toDate } from '@/utils/date';
import { parseLogisticsLineKey } from '@/modules/clothing/operations/shipments/lib/logisticsCosts';

export function calculateCostCorrection(input: {
  quantity: number;
  soldQuantity: number;
  oldUnitCost: number;
  newUnitCost: number;
}) {
  if (
    Object.values(input).some((value) => !Number.isFinite(value)) ||
    input.quantity <= 0 ||
    input.soldQuantity < 0 ||
    input.soldQuantity > input.quantity ||
    input.oldUnitCost < 0 ||
    input.newUnitCost < 0
  ) {
    throw new FinancialOperationError(
      'Confirmed quantities and nonnegative costs are required for a dated correction.',
      400
    );
  }
  const delta = new Prisma.Decimal(input.newUnitCost).minus(input.oldUnitCost);
  const totalDelta = delta.times(input.quantity).toDecimalPlaces(2);
  const soldDelta = delta.times(input.soldQuantity).toDecimalPlaces(2);
  if (totalDelta.isZero()) {
    throw new FinancialOperationError(
      'The confirmed cost has not changed.',
      400
    );
  }
  return {
    totalDelta: totalDelta.toNumber(),
    soldDelta: soldDelta.toNumber(),
    stockDelta: totalDelta.minus(soldDelta).toNumber(),
    soldQuantity: input.soldQuantity,
    stockQuantity: new Prisma.Decimal(input.quantity)
      .minus(input.soldQuantity)
      .toNumber(),
  };
}

export const zeroCostConfirmationSchema = z
  .object({
    movementId: z.number().int().positive(),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();

export const costCorrectionSchema = z
  .object({
    productId: z.number().int().positive(),
    expectedUnitCost: z.number().finite().nonnegative(),
    newUnitCost: z.number().finite().nonnegative(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (value) => dayjs(value, 'YYYY-MM-DD', true).isValid(),
        'Invalid correction date'
      ),
    capitalizationLineId: z.string().min(1).max(100),
    reason: z.string().trim().min(10).max(1000),
    confirmZeroCost: z.boolean().optional(),
  })
  .strict();

export async function recordDatedCostCorrection(
  requestId: string,
  input: z.infer<typeof costCorrectionSchema>,
  actor: { id: string; role: string }
) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
    throw new FinancialOperationError(
      'Only an administrator can approve a cost correction.',
      403
    );
  }
  const details = costCorrectionSchema.parse(input);
  if (details.newUnitCost === 0 && details.confirmZeroCost !== true) {
    throw new FinancialOperationError(
      'Explicitly confirm genuinely zero-cost goods before reducing their cost to zero.',
      400
    );
  }
  const effectiveDate = toDate(details.date);
  if (
    !effectiveDate ||
    details.date > getCurrentDateISO() ||
    effectiveDate < (await getRuntimeAccountingCutoverDate())
  ) {
    throw new FinancialOperationError(
      'Use an actual correction date within the accounting period and not in the future.',
      400
    );
  }
  return runFinancialRequest(
    requestId,
    'INVENTORY_COST_CORRECTION',
    { ...details, actorId: actor.id },
    async (client, key) => {
      const product = await client.product.findUnique({
        where: { id: details.productId },
      });
      if (!product || product.deletedAt || !product.productCode) {
        throw new FinancialOperationError('Active product not found.', 404);
      }
      const products = await client.product.findMany({
        where: { productCode: product.productCode, deletedAt: null },
        select: { id: true },
      });
      if (products.length !== 1) {
        throw new FinancialOperationError(
          'This product code identifies multiple lots. Review the lot ownership before correcting costs.'
        );
      }
      const oldUnitCost = pickUnitCostFromProductRow(product);
      if (
        new Prisma.Decimal(oldUnitCost).equals(details.expectedUnitCost) ===
        false
      ) {
        throw new FinancialOperationError(
          'The product cost changed. Refresh before approving this correction.'
        );
      }
      const previous = await client.clothingFinancialRequest.findMany({
        where: { operation: 'INVENTORY_COST_CORRECTION' },
        select: { result: true },
        orderBy: { createdAt: 'asc' },
      });
      const approvedBasisByMovement = new Map<number, number>();
      for (const request of previous) {
        const result = request.result;
        if (
          !result ||
          typeof result !== 'object' ||
          Array.isArray(result) ||
          result.productId !== product.id ||
          typeof result.newUnitCost !== 'number' ||
          !Array.isArray(result.resolvedMovementIds)
        ) {
          continue;
        }
        for (const movementId of result.resolvedMovementIds) {
          if (typeof movementId === 'number') {
            approvedBasisByMovement.set(movementId, result.newUnitCost);
          }
        }
      }
      const movements = await client.inventoryMovement.findMany({
        where: { productCode: product.productCode, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      const latestDate = dayjs(effectiveDate)
        .tz('Asia/Manila')
        .endOf('day')
        .toDate();
      if (
        movements.some((movement) => pickMovementDate(movement) > latestDate)
      ) {
        throw new FinancialOperationError(
          'Later inventory movements exist. Use a correction date after those events; history will not be rewritten.'
        );
      }
      let soldQuantity = new Prisma.Decimal(0);
      for (const movement of movements) {
        if (
          movement.toBucket === 'scrap' ||
          movement.fromBucket === 'assembly_wip' ||
          movement.toBucket === 'assembly_wip'
        ) {
          throw new FinancialOperationError(
            'Scrapped or transformed goods require a separately reviewed valuation correction.'
          );
        }
        if (movement.toBucket === 'sold') {
          soldQuantity = soldQuantity.plus(movement.quantity);
        } else if (
          movement.fromBucket === 'sold' &&
          INVENTORY_ASSET_BUCKETS.has(movement.toBucket)
        ) {
          soldQuantity = soldQuantity.minus(movement.quantity);
        } else if (movement.fromBucket === 'sold') {
          throw new FinancialOperationError(
            'This return has no supported inventory valuation destination.'
          );
        }
        if (
          (movement.toBucket === 'sold' || movement.fromBucket === 'sold') &&
          movement.unitCost !== null &&
          new Prisma.Decimal(movement.unitCost).equals(oldUnitCost) === false &&
          approvedBasisByMovement.get(movement.id) !== oldUnitCost
        ) {
          throw new FinancialOperationError(
            'Movement costs differ from the current lot basis. Review the original snapshots before correcting this lot.'
          );
        }
      }
      const allocation = calculateCostCorrection({
        quantity: Number(product.quantity),
        soldQuantity: soldQuantity.toNumber(),
        oldUnitCost,
        newUnitCost: details.newUnitCost,
      });
      let alreadyAllocated = new Prisma.Decimal(0);
      for (const request of previous) {
        const result = request.result;
        if (!result || typeof result !== 'object' || Array.isArray(result)) {
          continue;
        }
        if (
          result.productId === product.id &&
          typeof result.date === 'string' &&
          result.date >= details.date
        ) {
          throw new FinancialOperationError(
            'A later correction already exists. Corrections must be posted in dated order.'
          );
        }
        if (
          result.capitalizationLineId === details.capitalizationLineId &&
          typeof result.totalDelta === 'number'
        ) {
          alreadyAllocated = alreadyAllocated.plus(result.totalDelta);
        }
      }
      const capitalized = await client.clothingAccountingJournalLine.findUnique(
        { where: { id: details.capitalizationLineId } }
      );
      if (
        !capitalized ||
        capitalized.deletedAt ||
        capitalized.account !== 'Stock on Hand' ||
        capitalized.date > latestDate
      ) {
        throw new FinancialOperationError(
          'Select an existing Stock on Hand capitalization line dated on or before this correction.'
        );
      }
      if (capitalized.sourceType === 'SHIPMENT_LOGISTICS') {
        const identity = parseLogisticsLineKey(capitalized.sourceLineKey);
        const shipment = identity
          ? await client.shipment.findUnique({
              where: { id: identity.shipmentId },
            })
          : null;
        if (
          identity?.action !== 'capitalize' ||
          !shipment ||
          shipment.shipmentCode !== product.shipmentCode
        ) {
          throw new FinancialOperationError(
            'The capitalization belongs to a different shipment.'
          );
        }
      } else if (
        capitalized.sourceType !== 'MANUAL' ||
        ![product.productCode, product.shipmentCode].includes(capitalized.ref)
      ) {
        throw new FinancialOperationError(
          'Use a guided logistics capitalization or a reviewed manual capitalization with this exact product/shipment reference.'
        );
      }
      const capitalizedAmount = new Prisma.Decimal(capitalized.debit).minus(
        capitalized.credit
      );
      const remaining = capitalizedAmount.minus(alreadyAllocated);
      if (
        remaining.isPositive() !== allocation.totalDelta > 0 ||
        remaining
          .abs()
          .lessThan(new Prisma.Decimal(allocation.totalDelta).abs())
      ) {
        throw new FinancialOperationError(
          'This cost delta exceeds the unallocated posted capitalization. No duplicate logistics cost was booked.'
        );
      }
      if (allocation.soldDelta !== 0) {
        const amount = Math.abs(allocation.soldDelta);
        const common = {
          date: effectiveDate,
          ref: `COST:${product.productCode}`,
          description: details.reason,
          sourceType: 'INVENTORY_COST_CORRECTION',
          sourceId: key,
          systemGenerated: true,
        };
        await client.clothingAccountingJournalLine.createMany({
          data: [
            {
              ...common,
              sourceLineKey: 'sold-cost',
              account: 'COGS',
              debit: allocation.soldDelta > 0 ? amount : 0,
              credit: allocation.soldDelta < 0 ? amount : 0,
            },
            {
              ...common,
              sourceLineKey: 'inventory-cost',
              account: 'Stock on Hand',
              debit: allocation.soldDelta < 0 ? amount : 0,
              credit: allocation.soldDelta > 0 ? amount : 0,
            },
          ],
        });
      }
      await client.product.update({
        where: { id: product.id },
        data: {
          landedUnitCost: details.newUnitCost,
          cogs: new Prisma.Decimal(details.newUnitCost)
            .times(Number(product.quantity))
            .toNumber(),
        },
      });
      const costingMovements = movements.filter(
        (movement) =>
          movement.toBucket === 'sold' || movement.fromBucket === 'sold'
      );
      return {
        ...details,
        ...allocation,
        oldUnitCost,
        productCode: product.productCode,
        resolvedMovementIds: costingMovements.map((movement) => movement.id),
        movementCosts: movements.map((movement) => ({
          movementId: movement.id,
          unitCost: movement.unitCost ?? oldUnitCost,
        })),
        approvedBy: actor.id,
        approvedAt: new Date().toISOString(),
      };
    }
  );
}

export async function confirmZeroCostMovement(
  requestId: string,
  input: z.infer<typeof zeroCostConfirmationSchema>,
  actor: { id: string; role: string }
) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
    throw new FinancialOperationError(
      'Only an administrator can confirm genuinely zero-cost goods.',
      403
    );
  }
  const details = zeroCostConfirmationSchema.parse(input);
  return runFinancialRequest(
    requestId,
    'ZERO_COST_CONFIRMATION',
    { ...details, actorId: actor.id },
    async (client) => {
      const movement = await client.inventoryMovement.findUnique({
        where: { id: details.movementId },
      });
      if (!movement || movement.deletedAt) {
        throw new FinancialOperationError('Inventory movement not found.', 404);
      }
      if (movement.toBucket !== 'sold' && movement.fromBucket !== 'sold') {
        throw new FinancialOperationError(
          'Confirm the actual sale or return movement.'
        );
      }
      if (movement.unitCost !== null && Number(movement.unitCost) !== 0) {
        throw new FinancialOperationError(
          'This movement already has a nonzero cost snapshot.'
        );
      }
      const previous = await client.clothingFinancialRequest.findFirst({
        where: {
          operation: 'ZERO_COST_CONFIRMATION',
          result: { path: ['movementId'], equals: details.movementId },
        },
      });
      if (previous) {
        throw new FinancialOperationError(
          'This movement already has a recorded zero-cost confirmation.'
        );
      }
      return {
        ...details,
        productCode: movement.productCode,
        quantity: movement.quantity,
        confirmedBy: actor.id,
        confirmedAt: new Date().toISOString(),
      };
    }
  );
}

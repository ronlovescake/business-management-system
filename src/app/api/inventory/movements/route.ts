import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import { parseDate } from '@/lib/accounting/date-utils';
import {
  FinancialOperationError,
  financialRequestId,
  runFinancialRequest,
} from '@/lib/accounting/financial-transactions';
import { transferInventoryCostLots } from '@/lib/inventory/cost-lots';
import { getCurrentDateISO } from '@/utils/date';

const movementSchema = z
  .object({
    productCode: z.string().min(1, 'productCode is required'),
    quantity: z.number().positive('quantity must be > 0'),
    fromBucket: z.enum([
      'sellable',
      'damaged_hold',
      'reserved',
      'assembly_wip',
      'scrap',
      'supplier_short',
      'sold',
    ]),
    toBucket: z.enum([
      'sellable',
      'damaged_hold',
      'reserved',
      'assembly_wip',
      'scrap',
      'supplier_short',
      'sold',
    ]),
    postingDate: z.string().optional(),
    notes: z.string().optional(),
    transferToProductCode: z.string().trim().min(1).optional(),
    reverseTransfer: z.boolean().optional(),
    supplierShortResolution: z
      .enum([
        'UNRESOLVED',
        'EXPECTED_LATER',
        'CREDIT_PENDING',
        'CREDIT_RECEIVED',
        'CREDIT_APPLIED',
      ])
      .optional(),
    supplierShortExpectedShipmentCode: z.string().max(100).optional(),
    supplierCreditReference: z.string().max(150).optional(),
    supplierCreditAmount: z.number().nonnegative().nullable().optional(),
  })
  .superRefine((movement, context) => {
    const isSupplierShort =
      movement.fromBucket === 'sellable' &&
      movement.toBucket === 'supplier_short' &&
      !(movement.notes ?? '').toLowerCase().startsWith('additionals') &&
      !(movement.notes ?? '').toLowerCase().startsWith('transfer');
    if (
      !isSupplierShort &&
      (movement.supplierShortResolution !== undefined ||
        movement.supplierShortExpectedShipmentCode !== undefined ||
        movement.supplierCreditReference !== undefined ||
        movement.supplierCreditAmount !== undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['supplierShortResolution'],
        message:
          'Supplier-short resolution fields require a Supplier Short movement.',
      });
    }
    if (
      isSupplierShort &&
      movement.supplierShortResolution === 'EXPECTED_LATER' &&
      !movement.supplierShortExpectedShipmentCode?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['supplierShortExpectedShipmentCode'],
        message: 'Provide the expected shipment code for goods expected later.',
      });
    }
    if (
      isSupplierShort &&
      (movement.supplierShortResolution === 'CREDIT_RECEIVED' ||
        movement.supplierShortResolution === 'CREDIT_APPLIED') &&
      !(Number(movement.supplierCreditAmount) > 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['supplierCreditAmount'],
        message: 'Provide the received supplier credit amount.',
      });
    }
  });

const movementPatchSchema = z.object({
  id: z.number().int().positive('id is required'),
  quantity: z.number().positive('quantity must be > 0').optional(),
  toBucket: z.enum(['damaged_hold', 'scrap', 'supplier_short']).optional(),
  postingDate: z.string().optional(),
  notes: z.string().optional(),
  supplierShortResolution: z
    .enum([
      'UNRESOLVED',
      'EXPECTED_LATER',
      'CREDIT_PENDING',
      'CREDIT_RECEIVED',
      'CREDIT_APPLIED',
    ])
    .optional(),
  supplierShortExpectedShipmentCode: z.string().max(100).nullable().optional(),
  supplierCreditReference: z.string().max(150).nullable().optional(),
  supplierCreditAmount: z.number().nonnegative().nullable().optional(),
});

function normalizeProductCode(value: string) {
  return value.trim();
}

export async function GET() {
  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: movements });
  } catch (error) {
    logger.error('Failed to fetch inventory movements', { error });
    return NextResponse.json(
      { error: 'Failed to fetch inventory movements' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = movementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      productCode,
      quantity,
      fromBucket,
      toBucket,
      postingDate,
      notes,
      supplierShortResolution,
      supplierShortExpectedShipmentCode,
      supplierCreditReference,
      supplierCreditAmount,
    } = parsed.data;

    if (fromBucket === toBucket) {
      return NextResponse.json(
        { error: 'fromBucket and toBucket must differ' },
        { status: 400 }
      );
    }

    const normalizedCode = normalizeProductCode(productCode);
    const freeGoods =
      fromBucket === 'supplier_short' &&
      toBucket === 'sellable' &&
      /^additionals\b/i.test(notes ?? '');

    if (parsed.data.transferToProductCode) {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      const date = postingDate?.trim() || getCurrentDateISO();
      const parsedDate = parseDate(date);
      const cutoff = await getRuntimeAccountingCutoverDate('clothing');
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !parsedDate ||
        parsedDate.toISOString().slice(0, 10) !== date ||
        parsedDate < cutoff ||
        date > getCurrentDateISO()
      ) {
        throw new FinancialOperationError(
          'Transfer date must be a valid clothing accounting date no later than today in Asia/Manila.',
          400
        );
      }
      const result = await runFinancialRequest(
        financialRequestId(request.headers),
        'INVENTORY_TRANSFER',
        { ...parsed.data, postingDate: date },
        (tx, requestId) =>
          transferInventoryCostLots(
            tx,
            {
              productCode: normalizedCode,
              transferToProductCode: parsed.data.transferToProductCode!,
              quantity,
              postingDate: date,
              notes,
              reverseTransfer: parsed.data.reverseTransfer,
            },
            requestId
          )
      );
      return NextResponse.json(result, { status: 201 });
    }
    if (/^transfer\b/i.test(notes ?? '')) {
      throw new FinancialOperationError(
        'Transfers must be submitted as one atomic source/destination request.',
        400
      );
    }

    return await prisma.$transaction(
      async (tx) => {
        const creditedProduct = await tx.product.findFirst({
          where: {
            deletedAt: null,
            supplierFulfillmentStatus: 'CREDIT_ISSUED',
            productCode: { equals: normalizedCode, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (creditedProduct) {
          return NextResponse.json(
            {
              error:
                'A supplier-nonfulfilled product cannot be moved back into physical inventory. Use the replacement purchase.',
            },
            { status: 409 }
          );
        }
        const created = await tx.inventoryMovement.create({
          data: {
            productCode: normalizedCode,
            quantity,
            ...(freeGoods ? { unitCost: 0, costBasis: 'FREE_GOODS' } : {}),
            fromBucket,
            toBucket,
            movementSource: 'inventory_adjustment',
            movementType: freeGoods ? 'free_goods_receipt' : 'adjustment',
            postingDate: postingDate?.trim() || null,
            notes,
            supplierShortResolution:
              fromBucket === 'sellable' &&
              toBucket === 'supplier_short' &&
              !(notes ?? '').toLowerCase().startsWith('additionals') &&
              !(notes ?? '').toLowerCase().startsWith('transfer')
                ? (supplierShortResolution ?? 'UNRESOLVED')
                : null,
            supplierShortExpectedShipmentCode:
              supplierShortExpectedShipmentCode?.trim() || null,
            supplierCreditReference: supplierCreditReference?.trim() || null,
            supplierCreditAmount: supplierCreditAmount ?? null,
          },
        });

        return NextResponse.json({ data: created }, { status: 201 });
      },
      { isolationLevel: 'Serializable' }
    );
  } catch (error) {
    if (error instanceof FinancialOperationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2034'
    ) {
      return NextResponse.json(
        { error: 'Inventory changed concurrently. Refresh before retrying.' },
        { status: 409 }
      );
    }
    logger.error('Failed to create inventory movement', { error });
    return NextResponse.json(
      { error: 'Failed to create inventory movement' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = movementPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      id,
      quantity,
      toBucket,
      postingDate,
      notes,
      supplierShortResolution,
      supplierShortExpectedShipmentCode,
      supplierCreditReference,
      supplierCreditAmount,
    } = parsed.data;

    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.inventoryMovement.findFirst({
          where: { id, deletedAt: null },
        });

        if (!existing) {
          return NextResponse.json(
            { error: 'Movement not found' },
            { status: 404 }
          );
        }

        // Only allow editing adjustment-style movements (keeps behavior predictable).
        if (
          [
            'supplier_nonfulfillment',
            'inventory_transfer',
            'inventory_split',
            'inventory_bundle',
          ].includes(existing.movementSource ?? '') ||
          existing.costBasis === 'FREE_GOODS'
        ) {
          return NextResponse.json(
            {
              error:
                'This source-owned inventory event cannot be edited independently. Use its recorded workflow.',
            },
            { status: 409 }
          );
        }
        const allowedDestinations = [
          'damaged_hold',
          'scrap',
          'supplier_short',
        ] as const;
        if (
          existing.fromBucket !== 'sellable' ||
          !allowedDestinations.includes(
            existing.toBucket as (typeof allowedDestinations)[number]
          )
        ) {
          return NextResponse.json(
            {
              error:
                'Only sellable -> damaged_hold/scrap/supplier_short movements can be edited',
            },
            { status: 400 }
          );
        }

        const isSupplierShort =
          existing.fromBucket === 'sellable' &&
          existing.toBucket === 'supplier_short' &&
          !(existing.notes ?? '').toLowerCase().startsWith('additionals') &&
          !(existing.notes ?? '').toLowerCase().startsWith('transfer');
        if (
          !isSupplierShort &&
          (supplierShortResolution !== undefined ||
            supplierShortExpectedShipmentCode !== undefined ||
            supplierCreditReference !== undefined ||
            supplierCreditAmount !== undefined)
        ) {
          return NextResponse.json(
            {
              error:
                'Supplier-short resolution fields require a Supplier Short movement',
            },
            { status: 400 }
          );
        }

        const resolution =
          supplierShortResolution ?? existing.supplierShortResolution;
        const expectedShipmentCode =
          supplierShortExpectedShipmentCode === undefined
            ? existing.supplierShortExpectedShipmentCode
            : supplierShortExpectedShipmentCode;
        const creditAmount =
          supplierCreditAmount === undefined
            ? existing.supplierCreditAmount
            : supplierCreditAmount;
        if (
          isSupplierShort &&
          resolution === 'EXPECTED_LATER' &&
          !expectedShipmentCode?.trim()
        ) {
          return NextResponse.json(
            {
              error:
                'Provide the expected shipment code for goods expected later',
            },
            { status: 400 }
          );
        }
        if (
          isSupplierShort &&
          (resolution === 'CREDIT_RECEIVED' ||
            resolution === 'CREDIT_APPLIED') &&
          !(Number(creditAmount) > 0)
        ) {
          return NextResponse.json(
            { error: 'Provide the received supplier credit amount' },
            { status: 400 }
          );
        }

        // fromBucket is always 'sellable' for editable adjustments; toBucket is restricted
        // to 'damaged_hold' | 'scrap', so they cannot be equal.

        const updated = await tx.inventoryMovement.update({
          where: { id },
          data: {
            quantity: typeof quantity === 'number' ? quantity : undefined,
            toBucket: typeof toBucket === 'string' ? toBucket : undefined,
            postingDate:
              typeof postingDate === 'string'
                ? postingDate.trim() || null
                : undefined,
            notes: typeof notes === 'string' ? notes : undefined,
            supplierShortResolution,
            supplierShortExpectedShipmentCode:
              supplierShortExpectedShipmentCode === undefined
                ? undefined
                : supplierShortExpectedShipmentCode?.trim() || null,
            supplierCreditReference:
              supplierCreditReference === undefined
                ? undefined
                : supplierCreditReference?.trim() || null,
            supplierCreditAmount,
          },
        });

        return NextResponse.json({ data: updated });
      },
      { isolationLevel: 'Serializable' }
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2034'
    ) {
      return NextResponse.json(
        { error: 'Inventory changed concurrently. Refresh before retrying.' },
        { status: 409 }
      );
    }
    logger.error('Failed to update inventory movement', { error });
    return NextResponse.json(
      { error: 'Failed to update inventory movement' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.inventoryMovement.findFirst({
          where: { id, deletedAt: null },
        });

        if (!existing) {
          return NextResponse.json(
            { error: 'Movement not found' },
            { status: 404 }
          );
        }

        // Only allow deleting adjustment-style movements.
        if (
          [
            'supplier_nonfulfillment',
            'inventory_transfer',
            'inventory_split',
            'inventory_bundle',
          ].includes(existing.movementSource ?? '') ||
          existing.costBasis === 'FREE_GOODS'
        ) {
          return NextResponse.json(
            {
              error:
                'This source-owned inventory event cannot be deleted independently. Use its recorded workflow.',
            },
            { status: 409 }
          );
        }
        const allowedDestinations = [
          'damaged_hold',
          'scrap',
          'supplier_short',
        ] as const;
        if (
          existing.fromBucket !== 'sellable' ||
          !allowedDestinations.includes(
            existing.toBucket as (typeof allowedDestinations)[number]
          )
        ) {
          return NextResponse.json(
            {
              error:
                'Only sellable -> damaged_hold/scrap/supplier_short movements can be deleted',
            },
            { status: 400 }
          );
        }

        const deleted = await tx.inventoryMovement.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        return NextResponse.json({ data: deleted });
      },
      { isolationLevel: 'Serializable' }
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2034'
    ) {
      return NextResponse.json(
        { error: 'Inventory changed concurrently. Refresh before retrying.' },
        { status: 409 }
      );
    }
    logger.error('Failed to delete inventory movement', { error });
    return NextResponse.json(
      { error: 'Failed to delete inventory movement' },
      { status: 500 }
    );
  }
}

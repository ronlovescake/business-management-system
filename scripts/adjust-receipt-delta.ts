import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  buildAutoReceiptAdjustmentNote,
  computeSellableReceiptAdjustment,
} from '@/lib/inventory/receiptAdjustments';

type Args = {
  productId?: number;
  productCode?: string;
  target?: number;
  postingDate?: string;
  negativeTo?: 'scrap' | 'damaged_hold';
  dryRun?: boolean;
  force?: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--force') {
      args.force = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next) {
      continue;
    }

    if (token === '--productId') {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.productId = parsed;
      }
      i += 1;
      continue;
    }

    if (token === '--productCode') {
      args.productCode = next;
      i += 1;
      continue;
    }

    if (token === '--target') {
      const parsed = Number(next);
      if (Number.isFinite(parsed)) {
        args.target = parsed;
      }
      i += 1;
      continue;
    }

    if (token === '--postingDate') {
      args.postingDate = next;
      i += 1;
      continue;
    }

    if (token === '--negativeTo') {
      if (next === 'scrap' || next === 'damaged_hold') {
        args.negativeTo = next;
      }
      i += 1;
      continue;
    }
  }

  return args;
}

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.productId && !args.productCode) {
    throw new Error('Provide either --productId or --productCode');
  }

  const product = args.productId
    ? await prisma.product.findUnique({
        where: { id: args.productId },
        select: {
          id: true,
          productCode: true,
          quantity: true,
          postingDate: true,
          orderDate: true,
        },
      })
    : await prisma.product.findFirst({
        where: {
          productCode: {
            equals: normalizeProductCode(args.productCode),
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          productCode: true,
          quantity: true,
          postingDate: true,
          orderDate: true,
        },
      });

  const productCode = normalizeProductCode(
    args.productCode ?? product?.productCode
  );
  if (!productCode) {
    throw new Error('Could not resolve productCode');
  }

  const target = args.target ?? product?.quantity;
  if (target === null || target === undefined) {
    throw new Error('Could not resolve target quantity; provide --target');
  }

  const postingDate =
    args.postingDate ?? product?.postingDate ?? product?.orderDate ?? null;

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      productCode: {
        equals: productCode,
        mode: 'insensitive',
      },
    },
    select: {
      productCode: true,
      quantity: true,
      fromBucket: true,
      toBucket: true,
    },
  });

  const adjustment = computeSellableReceiptAdjustment({
    productCode,
    targetSellableOnHand: target,
    movements,
    negativeToBucket: args.negativeTo ?? 'scrap',
  });

  if (adjustment.action === 'noop') {
    logger.info('No adjustment needed', {
      productCode: adjustment.normalizedProductCode,
      currentSellableOnHand: adjustment.currentSellableOnHand,
      targetSellableOnHand: adjustment.targetSellableOnHand,
    });
    return;
  }

  const note = buildAutoReceiptAdjustmentNote({
    productId: product?.id ?? args.productId ?? null,
    targetSellableOnHand: adjustment.targetSellableOnHand,
  });

  const movement = adjustment.movement;
  if (!movement) {
    throw new Error('Expected movement payload');
  }

  const payload = {
    productCode,
    quantity: movement.quantity,
    fromBucket: movement.fromBucket,
    toBucket: movement.toBucket,
    postingDate,
    notes: note,
  };

  logger.info('Computed receipt delta adjustment', {
    productCode: adjustment.normalizedProductCode,
    currentSellableOnHand: adjustment.currentSellableOnHand,
    targetSellableOnHand: adjustment.targetSellableOnHand,
    delta: adjustment.delta,
    movement: {
      fromBucket: payload.fromBucket,
      toBucket: payload.toBucket,
      quantity: payload.quantity,
    },
    postingDate: payload.postingDate,
    notes: payload.notes,
  });

  if (!args.force) {
    const existing = await prisma.inventoryMovement.findFirst({
      where: {
        deletedAt: null,
        productCode: {
          equals: productCode,
          mode: 'insensitive',
        },
        fromBucket: payload.fromBucket,
        toBucket: payload.toBucket,
        quantity: payload.quantity,
        postingDate: payload.postingDate,
        notes: payload.notes,
      },
      select: { id: true },
    });

    if (existing) {
      logger.info('Adjustment already exists (idempotent skip)', {
        existingMovementId: existing.id,
        productCode,
        notes: payload.notes,
      });
      return;
    }
  }

  if (args.dryRun) {
    logger.info('Dry run: would create adjustment movement', payload);
    return;
  }

  const created = await prisma.inventoryMovement.create({
    data: payload,
  });

  logger.info('Created adjustment movement', {
    id: created.id,
    ...payload,
  });
}

if (require.main === module) {
  main()
    .catch((error) => {
      logger.error('adjust-receipt-delta failed', { error });
      process.exitCode = 1;
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}

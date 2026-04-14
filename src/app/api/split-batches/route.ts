import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { toStoredSplitName, fromStoredSplitName } from '@/lib/inventory/splitTag';
import { isStoredMixAndMatchName } from '@/lib/inventory/mixAndMatchTag';

export const dynamic = 'force-dynamic';

interface ComponentInput {
  componentLabel: string;
  componentSku: string;
  componentPrice: number;
  includedQuantity: number;
}

interface UpsertSplitRequest {
  id?: number;
  postingDate: string;
  splitSku: string;
  components: ComponentInput[];
}

function parseAndValidate(body: UpsertSplitRequest) {
  const postingDate = (body.postingDate ?? '').trim();
  const splitSku = (body.splitSku ?? '').trim();
  const components = Array.isArray(body.components) ? body.components : [];

  if (!postingDate || !splitSku) {
    return {
      error: 'postingDate and splitSku are required',
    };
  }

  const normalizedComponents = components
    .map((c) => ({
      componentLabel: (c.componentLabel ?? '').trim(),
      componentSku: (c.componentSku ?? '').trim(),
      componentPrice: Number(c.componentPrice),
      includedQuantity: Number(c.includedQuantity),
    }))
    .filter(
      (c) =>
        c.componentLabel.length > 0 &&
        c.componentSku.length > 0 &&
        Number.isFinite(c.componentPrice) &&
        c.componentPrice >= 0 &&
        Number.isFinite(c.includedQuantity) &&
        c.includedQuantity > 0
    );

  if (normalizedComponents.length < 2) {
    return {
      error: 'At least two components are required for a split',
    };
  }

  return {
    postingDate,
    splitSku,
    normalizedComponents,
  };
}

function formatSplitBatchResponse(row: {
  id: number;
  postingDate: string;
  splitName: string;
  splitSku: string;
  components: Array<{
    id: number;
    componentLabel: string;
    componentSku: string;
    componentPrice: number;
    includedQuantity: number;
  }>;
}) {
  return {
    id: row.id,
    postingDate: row.postingDate,
    splitName: fromStoredSplitName(row.splitName),
    splitSku: row.splitSku,
    components: row.components.map((c) => ({
      id: c.id,
      componentLabel: c.componentLabel,
      componentSku: c.componentSku,
      componentPrice: c.componentPrice,
      includedQuantity: c.includedQuantity,
    })),
  };
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function validateSplitBatch(
  tx: PrismaTx,
  parsed: {
    splitSku: string;
    normalizedComponents: Array<{
      componentLabel: string;
      componentSku: string;
      componentPrice: number;
      includedQuantity: number;
    }>;
  },
  excludeBatchId?: number
) {
  // Rule 35: parent SKU can only be parent of one active SplitBatch
  const existingParent = await tx.splitBatch.findFirst({
    where: {
      splitSku: parsed.splitSku,
      ...(excludeBatchId ? { id: { not: excludeBatchId } } : {}),
    },
    select: { id: true },
  });

  if (existingParent) {
    throw new Error(
      'VALIDATION:This parent SKU already has an active split batch'
    );
  }

  // Rule 40: parent SKU must not be a MnM or Bundle SKU
  const compositeMatch = await tx.bundleBatch.findFirst({
    where: { bundleSku: { equals: parsed.splitSku, mode: 'insensitive' } },
    select: { bundleName: true },
  });

  if (compositeMatch) {
    const label = isStoredMixAndMatchName(compositeMatch.bundleName)
      ? 'Mix & Match'
      : 'Bundle';
    throw new Error(
      `VALIDATION:Parent SKU is already used as a ${label} SKU and cannot be split`
    );
  }

  // Rule 36: component SKUs must be unique across all SplitBatches
  const componentSkus = parsed.normalizedComponents.map((c) => c.componentSku);

  const conflictingComponents = await tx.splitBatchComponent.findMany({
    where: {
      componentSku: { in: componentSkus },
      ...(excludeBatchId
        ? { splitBatch: { id: { not: excludeBatchId } } }
        : {}),
    },
    select: { componentSku: true, splitBatch: { select: { splitName: true } } },
  });

  if (conflictingComponents.length > 0) {
    const conflicts = conflictingComponents
      .map(
        (c) =>
          `"${c.componentSku}" (used in ${fromStoredSplitName(c.splitBatch.splitName)})`
      )
      .join(', ');
    throw new Error(
      `VALIDATION:Component SKU(s) already used in another split batch: ${conflicts}`
    );
  }
}

export async function GET() {
  try {
    const rows = await prisma.splitBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { components: true },
    });

    return NextResponse.json(rows.map(formatSplitBatchResponse), {
      status: 200,
    });
  } catch (error) {
    logger.error('Failed to load split batches', error);
    return NextResponse.json(
      { error: 'Failed to load split batches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UpsertSplitRequest;
    const parsed = parseAndValidate(body);

    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      // Validate: parent SKU must exist
      const parentProduct = await tx.product.findFirst({
        where: { productCode: parsed.splitSku, deletedAt: null },
      });

      if (!parentProduct) {
        throw new Error('VALIDATION:Parent product not found');
      }

      const derivedSplitName = (parentProduct.product ?? '').trim();
      if (!derivedSplitName) {
        throw new Error('VALIDATION:Parent product name not found');
      }

      await validateSplitBatch(tx, parsed);

      // Create the split batch
      const batch = await tx.splitBatch.create({
        data: {
          postingDate: parsed.postingDate,
          splitName: toStoredSplitName(derivedSplitName),
          splitSku: parsed.splitSku,
          components: {
            create: parsed.normalizedComponents.map((c) => ({
              componentLabel: c.componentLabel,
              componentSku: c.componentSku,
              componentPrice: c.componentPrice,
              includedQuantity: c.includedQuantity,
            })),
          },
        },
        include: { components: true },
      });

      return batch;
    });

    return NextResponse.json(formatSplitBatchResponse(created), {
      status: 201,
    });
  } catch (error) {
    logger.error('Failed to create split batch', error);

    const message =
      error instanceof Error ? error.message : 'Failed to create split batch';

    if (message.startsWith('VALIDATION:')) {
      return NextResponse.json(
        { error: message.slice('VALIDATION:'.length) },
        { status: 400 }
      );
    }

    if (message.toLowerCase().includes('unique')) {
      return NextResponse.json(
        { error: 'Split SKU already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create split batch' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as UpsertSplitRequest;
    const id = Number(body.id);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const parsed = parseAndValidate(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existing = await prisma.splitBatch.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Split batch not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Validate: parent SKU must exist
      const parentProduct = await tx.product.findFirst({
        where: { productCode: parsed.splitSku, deletedAt: null },
      });

      if (!parentProduct) {
        throw new Error('VALIDATION:Parent product not found');
      }

      const derivedSplitName = (parentProduct.product ?? '').trim();
      if (!derivedSplitName) {
        throw new Error('VALIDATION:Parent product name not found');
      }

      await validateSplitBatch(tx, parsed, id);

      const updatedBatch = await tx.splitBatch.update({
        where: { id },
        data: {
          postingDate: parsed.postingDate,
          splitName: toStoredSplitName(derivedSplitName),
          splitSku: parsed.splitSku,
          components: {
            deleteMany: {},
            create: parsed.normalizedComponents.map((c) => ({
              componentLabel: c.componentLabel,
              componentSku: c.componentSku,
              componentPrice: c.componentPrice,
              includedQuantity: c.includedQuantity,
            })),
          },
        },
        include: { components: true },
      });

      return updatedBatch;
    });

    return NextResponse.json(formatSplitBatchResponse(updated), {
      status: 200,
    });
  } catch (error) {
    logger.error('Failed to update split batch', error);

    const message =
      error instanceof Error ? error.message : 'Failed to update split batch';

    if (message.startsWith('VALIDATION:')) {
      return NextResponse.json(
        { error: message.slice('VALIDATION:'.length) },
        { status: 400 }
      );
    }

    if (message.toLowerCase().includes('unique')) {
      return NextResponse.json(
        { error: 'Split SKU already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update split batch' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await prisma.splitBatch.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Split batch not found' },
        { status: 404 }
      );
    }

    // Note: We do NOT delete auto-created child Product rows
    // because they may already have transaction history.
    await prisma.splitBatch.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('Failed to delete split batch', error);
    return NextResponse.json(
      { error: 'Failed to delete split batch' },
      { status: 500 }
    );
  }
}

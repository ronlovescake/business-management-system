import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  fromStoredMixAndMatchName,
  isStoredMixAndMatchName,
  toStoredMixAndMatchName,
} from '@/lib/inventory/mixAndMatchTag';

export const dynamic = 'force-dynamic';

type ComponentInput = {
  productCode: string;
  includedQuantity: number;
};

type UpsertMixAndMatchRequest = {
  id?: number;
  postingDate: string;
  mixAndMatchName: string;
  mixAndMatchSku: string;
  quantity?: number;
  price: number;
  components: ComponentInput[];
};

type GMMixAndMatchClient = Pick<
  typeof prisma,
  | 'generalMerchandiseBundleBatch'
  | 'generalMerchandiseTransaction'
  | 'generalMerchandiseInventoryMovement'
>;

const gmClient: GMMixAndMatchClient = prisma;

function buildAutoReserveMovementNote(transactionId: number) {
  return `auto-reserve txn ${transactionId}`;
}

function buildAutoSaleMovementNote(transactionId: number) {
  return `auto-sale txn ${transactionId}`;
}

function buildAutoMixReserveMovementPrefix(transactionId: number) {
  return `auto-reserve txn ${transactionId} mix `;
}

function buildAutoMixSaleMovementPrefix(transactionId: number) {
  return `auto-sale txn ${transactionId} mix `;
}

function parseAndValidate(body: UpsertMixAndMatchRequest) {
  const postingDate = (body.postingDate ?? '').trim();
  const mixAndMatchName = (body.mixAndMatchName ?? '').trim();
  const mixAndMatchSku = (body.mixAndMatchSku ?? '').trim();
  const quantity = Number(body.quantity ?? 0);
  const price = Number(body.price);
  const components = Array.isArray(body.components) ? body.components : [];

  if (!postingDate || !mixAndMatchName || !mixAndMatchSku) {
    return {
      error: 'postingDate, mixAndMatchName, and mixAndMatchSku are required',
    };
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: 'price must be a number greater than or equal to 0' };
  }

  const normalizedComponents = components
    .map((component) => ({
      productCode: (component.productCode ?? '').trim(),
      includedQuantity: Number(component.includedQuantity),
    }))
    .filter(
      (component) =>
        component.productCode.length > 0 &&
        Number.isFinite(component.includedQuantity) &&
        component.includedQuantity > 0
    );

  if (normalizedComponents.length === 0) {
    return {
      error: 'At least one component with includedQuantity > 0 is required',
    };
  }

  return {
    postingDate,
    mixAndMatchName,
    mixAndMatchSku,
    quantity,
    price,
    normalizedComponents,
  };
}

export async function GET() {
  try {
    const rows = await gmClient.generalMerchandiseBundleBatch.findMany({
      where: {
        bundleName: {
          startsWith: '[MIXMATCH] ',
        },
      },
      include: { components: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        postingDate: row.postingDate,
        mixAndMatchName: fromStoredMixAndMatchName(row.bundleName),
        mixAndMatchSku: row.bundleSku,
        quantity: row.quantity,
        price: row.price,
        components: row.components.map((component) => ({
          id: component.id,
          productCode: component.componentProductCode,
          includedQuantity: component.includedQuantity,
        })),
      })),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Failed to load GM mix & match rows', error);
    return NextResponse.json(
      { error: 'Failed to load mix & match rows' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UpsertMixAndMatchRequest;
    const parsed = parseAndValidate(body);

    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const created = await gmClient.generalMerchandiseBundleBatch.create({
      data: {
        postingDate: parsed.postingDate,
        bundleName: toStoredMixAndMatchName(parsed.mixAndMatchName),
        bundleSku: parsed.mixAndMatchSku,
        quantity: parsed.quantity,
        price: parsed.price,
        components: {
          create: parsed.normalizedComponents.map((component) => ({
            componentProductCode: component.productCode,
            includedQuantity: component.includedQuantity,
          })),
        },
      },
      include: { components: true },
    });

    return NextResponse.json(
      {
        id: created.id,
        postingDate: created.postingDate,
        mixAndMatchName: fromStoredMixAndMatchName(created.bundleName),
        mixAndMatchSku: created.bundleSku,
        quantity: created.quantity,
        price: created.price,
        components: created.components.map((component) => ({
          id: component.id,
          productCode: component.componentProductCode,
          includedQuantity: component.includedQuantity,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to create GM mix & match row', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to create mix & match row';

    if (message.toLowerCase().includes('unique')) {
      return NextResponse.json(
        { error: 'Mix & Match SKU already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create mix & match row' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as UpsertMixAndMatchRequest;
    const id = Number(body.id);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const parsed = parseAndValidate(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existing = await gmClient.generalMerchandiseBundleBatch.findUnique({
      where: { id },
    });

    if (!existing || !isStoredMixAndMatchName(existing.bundleName)) {
      return NextResponse.json(
        { error: 'Mix & Match row not found' },
        { status: 404 }
      );
    }

    const updated = await gmClient.generalMerchandiseBundleBatch.update({
      where: { id },
      data: {
        postingDate: parsed.postingDate,
        bundleName: toStoredMixAndMatchName(parsed.mixAndMatchName),
        bundleSku: parsed.mixAndMatchSku,
        quantity: parsed.quantity,
        price: parsed.price,
        components: {
          deleteMany: {},
          create: parsed.normalizedComponents.map((component) => ({
            componentProductCode: component.productCode,
            includedQuantity: component.includedQuantity,
          })),
        },
      },
      include: { components: true },
    });

    return NextResponse.json(
      {
        id: updated.id,
        postingDate: updated.postingDate,
        mixAndMatchName: fromStoredMixAndMatchName(updated.bundleName),
        mixAndMatchSku: updated.bundleSku,
        quantity: updated.quantity,
        price: updated.price,
        components: updated.components.map((component) => ({
          id: component.id,
          productCode: component.componentProductCode,
          includedQuantity: component.includedQuantity,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Failed to update GM mix & match row', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update mix & match row';
    if (message.toLowerCase().includes('unique')) {
      return NextResponse.json(
        { error: 'Mix & Match SKU already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update mix & match row' },
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

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.generalMerchandiseBundleBatch.findUnique({
        where: { id },
      });

      if (!existing || !isStoredMixAndMatchName(existing.bundleName)) {
        return { notFound: true as const };
      }

      const relatedTransactions =
        await tx.generalMerchandiseTransaction.findMany({
          where: {
            deletedAt: null,
            productCode: {
              equals: existing.bundleSku,
              mode: 'insensitive',
            },
          },
          select: { id: true },
        });

      if (relatedTransactions.length > 0) {
        const now = new Date();
        const movementFilters = relatedTransactions.flatMap(
          ({ id: transactionId }) => [
            { notes: buildAutoReserveMovementNote(transactionId) },
            { notes: buildAutoSaleMovementNote(transactionId) },
            {
              notes: {
                startsWith: buildAutoMixReserveMovementPrefix(transactionId),
              },
            },
            {
              notes: {
                startsWith: buildAutoMixSaleMovementPrefix(transactionId),
              },
            },
          ]
        );

        await tx.generalMerchandiseInventoryMovement.updateMany({
          where: {
            deletedAt: null,
            OR: movementFilters,
          },
          data: { deletedAt: now },
        });
      }

      await tx.generalMerchandiseBundleBatch.delete({ where: { id } });
      return { notFound: false as const };
    });

    if (deleted.notFound) {
      return NextResponse.json(
        { error: 'Mix & Match row not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('Failed to delete GM mix & match row', error);
    return NextResponse.json(
      { error: 'Failed to delete mix & match row' },
      { status: 500 }
    );
  }
}

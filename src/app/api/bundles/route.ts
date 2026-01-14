import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface CreateBundleComponentInput {
  productCode: string;
  includedQuantity: number;
}

interface CreateBundleRequest {
  postingDate: string;
  bundleName: string;
  bundleSku: string;
  quantity: number;
  price: number;
  components: CreateBundleComponentInput[];
}

export async function GET() {
  try {
    const bundles = await prisma.bundleBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { components: true },
    });

    return NextResponse.json(bundles, { status: 200 });
  } catch (error) {
    logger.error('Failed to load bundles', error);
    return NextResponse.json(
      { error: 'Failed to load bundles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateBundleRequest;

    const postingDate = body.postingDate?.trim();
    const bundleName = body.bundleName?.trim();
    const bundleSku = body.bundleSku?.trim();
    const quantity = Number(body.quantity);
    const price = Number(body.price);
    const components = Array.isArray(body.components) ? body.components : [];

    if (!postingDate || !bundleName || !bundleSku) {
      return NextResponse.json(
        { error: 'postingDate, bundleName, and bundleSku are required' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be a number greater than 0' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: 'price must be a number greater than or equal to 0' },
        { status: 400 }
      );
    }

    if (components.length === 0) {
      return NextResponse.json(
        { error: 'At least one component is required' },
        { status: 400 }
      );
    }

    const normalizedComponents = components
      .map((c) => ({
        productCode: (c.productCode ?? '').trim(),
        includedQuantity: Number(c.includedQuantity),
      }))
      .filter(
        (c) =>
          c.productCode.length > 0 &&
          Number.isFinite(c.includedQuantity) &&
          c.includedQuantity > 0
      );

    if (normalizedComponents.length === 0) {
      return NextResponse.json(
        { error: 'Components must have productCode and includedQuantity > 0' },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.bundleBatch.create({
        data: {
          postingDate,
          bundleName,
          bundleSku,
          quantity,
          price,
          components: {
            create: normalizedComponents.map((c) => ({
              componentProductCode: c.productCode,
              includedQuantity: c.includedQuantity,
            })),
          },
        },
        include: { components: true },
      });

      const note = `bundle-assembly batch ${createdBatch.id} sku ${bundleSku}`;

      // Consume component inventory (sellable -> assembly_wip) for each component.
      await tx.inventoryMovement.createMany({
        data: normalizedComponents.map((component) => ({
          productCode: component.productCode.trim(),
          quantity: component.includedQuantity * quantity,
          fromBucket: 'sellable',
          toBucket: 'assembly_wip',
          postingDate,
          notes: note,
        })),
      });

      // Produce the bundled SKU (assembly_wip -> sellable) for the batch quantity.
      await tx.inventoryMovement.create({
        data: {
          productCode: bundleSku,
          quantity,
          fromBucket: 'assembly_wip',
          toBucket: 'sellable',
          postingDate,
          notes: note,
        },
      });

      return createdBatch;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Failed to create bundle', error);

    // Prisma unique constraint errors are usually safe to surface as a 409
    const message =
      error instanceof Error ? error.message : 'Failed to create bundle';
    if (message.toLowerCase().includes('unique')) {
      return NextResponse.json(
        { error: 'Bundle SKU already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create bundle' },
      { status: 500 }
    );
  }
}

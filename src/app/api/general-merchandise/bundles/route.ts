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

interface UpdateBundleRequest extends CreateBundleRequest {
  id: number;
}

const gmPrisma = prisma as unknown as {
  generalMerchandiseBundleBatch: typeof prisma.bundleBatch;
  generalMerchandiseInventoryMovement: typeof prisma.inventoryMovement;
};

export async function GET() {
  try {
    const bundles = await gmPrisma.generalMerchandiseBundleBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { components: true },
    });

    return NextResponse.json(bundles, { status: 200 });
  } catch (error) {
    logger.error('Failed to load GM bundles', error);
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
      const gmTx = tx as unknown as typeof gmPrisma;

      const createdBatch = await gmTx.generalMerchandiseBundleBatch.create({
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
      await gmTx.generalMerchandiseInventoryMovement.createMany({
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
      await gmTx.generalMerchandiseInventoryMovement.create({
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
    logger.error('Failed to create GM bundle', error);

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

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as UpdateBundleRequest;

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

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

    const existing = await gmPrisma.generalMerchandiseBundleBatch.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Bundle batch not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const gmTx = tx as unknown as typeof gmPrisma;
      const notePrefix = `bundle-assembly batch ${id} `;
      await gmTx.generalMerchandiseInventoryMovement.updateMany({
        where: {
          notes: { startsWith: notePrefix },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      const updatedBatch = await gmTx.generalMerchandiseBundleBatch.update({
        where: { id },
        data: {
          postingDate,
          bundleName,
          bundleSku,
          quantity,
          price,
          components: {
            deleteMany: {},
            create: normalizedComponents.map((c) => ({
              componentProductCode: c.productCode,
              includedQuantity: c.includedQuantity,
            })),
          },
        },
        include: { components: true },
      });

      const note = `bundle-assembly batch ${updatedBatch.id} sku ${bundleSku}`;

      await gmTx.generalMerchandiseInventoryMovement.createMany({
        data: normalizedComponents.map((component) => ({
          productCode: component.productCode.trim(),
          quantity: component.includedQuantity * quantity,
          fromBucket: 'sellable',
          toBucket: 'assembly_wip',
          postingDate,
          notes: note,
        })),
      });

      await gmTx.generalMerchandiseInventoryMovement.create({
        data: {
          productCode: bundleSku,
          quantity,
          fromBucket: 'assembly_wip',
          toBucket: 'sellable',
          postingDate,
          notes: note,
        },
      });

      return updatedBatch;
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    logger.error('Failed to update GM bundle', error);

    const message =
      error instanceof Error ? error.message : 'Failed to update bundle';
    if (message.toLowerCase().includes('unique')) {
      return NextResponse.json(
        { error: 'Bundle SKU already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update bundle' },
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

    const existing = await gmPrisma.generalMerchandiseBundleBatch.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Bundle batch not found' },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const gmTx = tx as unknown as typeof gmPrisma;
      const notePrefix = `bundle-assembly batch ${id} `;
      await gmTx.generalMerchandiseInventoryMovement.updateMany({
        where: {
          notes: { startsWith: notePrefix },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      await gmTx.generalMerchandiseBundleBatch.delete({ where: { id } });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('Failed to delete GM bundle', error);
    return NextResponse.json(
      { error: 'Failed to delete bundle' },
      { status: 500 }
    );
  }
}

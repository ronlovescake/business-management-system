import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { mapFromDTO, mapToDTO } from './dto';
import type { ProductDTO } from './dto';

async function logOperationNotification(
  category: string,
  changes: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const id = randomUUID();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const philippineTime = new Date(now);

    await prisma.$executeRaw`
      INSERT INTO "operations_notifications" (id, category, "user", changes, metadata, "createdAt")
      VALUES (${id}, ${category}, ${'Operations'}, ${changes}, ${metadataJson}::jsonb, ${philippineTime})
    `;
  } catch (error) {
    logger.warn('Failed to log operations notification', { error, category });
  }
}

export interface ProductService {
  findActive: () => Promise<ProductDTO[]>;
  createSingle: (payload: ProductDTO) => Promise<ProductDTO>;
  bulkImport: (
    payload: ProductDTO[]
  ) => Promise<{ created: number; updated: number; restored: number }>;
  bulkUpdate: (
    payload: ProductDTO[]
  ) => Promise<{
    created: number;
    updated: number;
    restored: number;
    notifications: number;
  }>;
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

function buildUpdateData(dto: ProductDTO): Prisma.ProductUpdateInput {
  const base = mapFromDTO(dto);
  return { ...base, deletedAt: null };
}

export const productService: ProductService = {
  async findActive() {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
    return products.map(mapToDTO);
  },

  async createSingle(payload) {
    const created = await prisma.product.create({ data: mapFromDTO(payload) });
    return mapToDTO(created);
  },

  async bulkImport(payload) {
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let restored = 0;

      for (const dto of payload) {
        const data = mapFromDTO(dto);
        const productCode = data.productCode;
        if (!productCode) {
          continue;
        }

        const existing = await tx.product.findFirst({
          where: { productCode },
        });

        if (existing) {
          const wasDeleted = existing.deletedAt !== null;
          await tx.product.update({
            where: { id: existing.id },
            data: buildUpdateData(dto),
          });
          if (wasDeleted) {
            restored++;
          } else {
            updated++;
          }
        } else {
          await tx.product.create({ data });
          created++;
        }
      }

      return { created, updated, restored };
    });

    return result;
  },

  async bulkUpdate(payload) {
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let restored = 0;
      const changeTracking: Array<{
        productId: number;
        productCode: string | null;
        shipmentCode: string | null;
        changes: string[];
      }> = [];

      for (const dto of payload) {
        const data = mapFromDTO(dto);
        const productCode = data.productCode;
        if (!productCode) {
          continue;
        }

        const existing = await tx.product.findFirst({
          where: { productCode },
        });

        if (existing) {
          const changes: string[] = [];

          const compare = <T>(label: string, prevValue: T, nextValue: T) => {
            if (prevValue !== nextValue) {
              changes.push(
                `${label}: ${prevValue ?? 'empty'} → ${nextValue ?? 'empty'}`
              );
            }
          };

          compare(
            'shipmentCode',
            existing.shipmentCode ?? 'empty',
            data.shipmentCode ?? 'empty'
          );
          compare(
            'productCode',
            existing.productCode ?? 'empty',
            data.productCode ?? 'empty'
          );
          compare('unitPrice', existing.unitPrice ?? 0, data.unitPrice ?? 0);
          compare('quantity', existing.quantity ?? 0, data.quantity ?? 0);
          compare(
            'alibabaShipping',
            existing.alibabaShippingCost ?? 0,
            data.alibabaShippingCost ?? 0
          );
          compare(
            'exchangeRate',
            existing.exchangeRates ?? 0,
            data.exchangeRates ?? 0
          );

          const wasDeleted = existing.deletedAt !== null;
          await tx.product.update({
            where: { id: existing.id },
            data: buildUpdateData(dto),
          });

          if (changes.length > 0) {
            changeTracking.push({
              productId: existing.id,
              productCode: productCode,
              shipmentCode: data.shipmentCode || null,
              changes,
            });
          }

          if (wasDeleted) {
            restored++;
          } else {
            updated++;
          }
        } else {
          const createdProduct = await tx.product.create({ data });
          created++;

          const changes: string[] = [];
          if (data.shipmentCode) {
            changes.push(`shipmentCode: empty → ${data.shipmentCode}`);
          }
          if (data.productCode) {
            changes.push(`productCode: empty → ${data.productCode}`);
          }
          if (data.unitPrice) {
            changes.push(`unitPrice: 0 → ${data.unitPrice}`);
          }
          if (data.quantity) {
            changes.push(`quantity: 0 → ${data.quantity}`);
          }
          if (data.alibabaShippingCost) {
            changes.push(`alibabaShipping: 0 → ${data.alibabaShippingCost}`);
          }
          if (data.exchangeRates) {
            changes.push(`exchangeRate: 0 → ${data.exchangeRates}`);
          }

          if (changes.length > 0) {
            changeTracking.push({
              productId: createdProduct.id,
              productCode,
              shipmentCode: data.shipmentCode || null,
              changes,
            });
          }
        }
      }

      return { created, updated, restored, changeTracking };
    });

    let notifications = 0;
    if (result.changeTracking.length > 0) {
      await Promise.all(
        result.changeTracking.map(
          async ({ productId, productCode, shipmentCode, changes }) => {
            let message = `Updated product #${productId}`;
            if (productCode && shipmentCode) {
              message += ` - ${productCode} (${shipmentCode})`;
            } else if (productCode) {
              message += ` - ${productCode}`;
            } else if (shipmentCode) {
              message += ` - (${shipmentCode})`;
            }
            if (changes.length > 0) {
              message += ` - Modified: ${changes.join(', ')}`;
            }
            await logOperationNotification('products', message, { productId });
          }
        )
      );
      notifications = result.changeTracking.length;
    }

    return {
      created: result.created,
      updated: result.updated,
      restored: result.restored,
      notifications,
    };
  },

  async softDeleteAll() {
    const alreadyDeleted = await prisma.product.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.product.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return { deleted: result.count, alreadyDeleted };
  },
};

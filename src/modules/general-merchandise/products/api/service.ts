import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { mapFromDTO, mapToDTO } from '@/modules/products/api/dto';
import type { ProductDTO } from '@/modules/products/api/dto';

export interface ProductService {
  findActive: () => Promise<ProductDTO[]>;
  createSingle: (payload: ProductDTO) => Promise<ProductDTO>;
  bulkImport: (
    payload: ProductDTO[]
  ) => Promise<{ created: number; updated: number; restored: number }>;
  bulkUpdate: (payload: ProductDTO[]) => Promise<{
    created: number;
    updated: number;
    restored: number;
    notifications: number;
  }>;
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

const gmPrisma = prisma as unknown as {
  generalMerchandiseProduct: typeof prisma.product;
};

function buildUpdateData(dto: ProductDTO): Prisma.ProductUpdateInput {
  const base = mapFromDTO(dto);
  return { ...base, deletedAt: null };
}

export const generalMerchandiseProductService: ProductService = {
  async findActive() {
    const products = await gmPrisma.generalMerchandiseProduct.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
    return products.map(mapToDTO);
  },

  async createSingle(payload) {
    const created = await gmPrisma.generalMerchandiseProduct.create({
      data: mapFromDTO(payload),
    });
    return mapToDTO(created);
  },

  async bulkImport(payload) {
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let restored = 0;

      for (const dto of payload) {
        const productCode = dto['Product Code']?.trim();
        const data = mapFromDTO(dto);
        const updateData = buildUpdateData(dto);

        if (dto.id) {
          await (
            tx as unknown as typeof gmPrisma
          ).generalMerchandiseProduct.upsert({
            where: { id: dto.id },
            create: data,
            update: updateData,
          });
          updated += 1;
          continue;
        }

        if (productCode) {
          const existing = await (
            tx as unknown as typeof gmPrisma
          ).generalMerchandiseProduct.findFirst({
            where: { productCode },
          });

          if (existing) {
            await (
              tx as unknown as typeof gmPrisma
            ).generalMerchandiseProduct.update({
              where: { id: existing.id },
              data: updateData,
            });
            if (existing.deletedAt) {
              restored += 1;
            } else {
              updated += 1;
            }
            continue;
          }
        }

        await (
          tx as unknown as typeof gmPrisma
        ).generalMerchandiseProduct.create({ data });
        created += 1;
      }

      return { created, updated, restored };
    });

    return result;
  },

  async bulkUpdate(payload) {
    const summary = await generalMerchandiseProductService.bulkImport(payload);
    return { ...summary, notifications: 0 };
  },

  async softDeleteAll() {
    const alreadyDeleted = await gmPrisma.generalMerchandiseProduct.count({
      where: { deletedAt: { not: null } },
    });

    const result = await gmPrisma.generalMerchandiseProduct.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return { deleted: result.count, alreadyDeleted };
  },
};

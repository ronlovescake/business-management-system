import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CustomerDTO } from './dto';
import { mapFromDTO, mapToDTO } from './dto';

export interface CustomerService {
  findActive: () => Promise<CustomerDTO[]>;
  bulkSync: (
    customers: CustomerDTO[]
  ) => Promise<{ created: number; updated: number }>;
  create: (customer: CustomerDTO) => Promise<CustomerDTO>;
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

export const customerService: CustomerService = {
  async findActive() {
    const customers = await prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
    return customers.map(mapToDTO);
  },

  async bulkSync(customers) {
    const result = await prisma.$transaction(
      async (tx) => {
        let createdCount = 0;
        let updatedCount = 0;

        for (const customer of customers) {
          const createData = mapFromDTO(customer);
          const updateData: Prisma.CustomerUpdateInput = {
            ...createData,
            deletedAt: null,
          };

          if (customer.id) {
            await tx.customer.upsert({
              where: { id: customer.id },
              create: createData,
              update: updateData,
            });
            updatedCount++;
            continue;
          }

          const existing = await tx.customer.findFirst({
            where: { customerName: createData.customerName },
          });

          if (existing) {
            await tx.customer.update({
              where: { id: existing.id },
              data: updateData,
            });
            updatedCount++;
          } else {
            await tx.customer.create({ data: createData });
            createdCount++;
          }
        }

        return { created: createdCount, updated: updatedCount };
      },
      {
        maxWait: 30000,
        timeout: 30000,
      }
    );

    return result;
  },

  async create(customer) {
    const created = await prisma.customer.create({
      data: mapFromDTO(customer),
    });
    return mapToDTO(created);
  },

  async softDeleteAll() {
    const alreadyDeleted = await prisma.customer.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.customer.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return { deleted: result.count, alreadyDeleted };
  },
};

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CustomerDTO } from '@/modules/customers/api/dto';
import { mapFromDTO, mapToDTO } from '@/modules/customers/api/dto';

type CustomerModel = Parameters<typeof mapToDTO>[0];

export interface CustomerService {
  findActive: () => Promise<CustomerDTO[]>;
  bulkSync: (
    customers: CustomerDTO[]
  ) => Promise<{ created: number; updated: number }>;
  create: (customer: CustomerDTO) => Promise<CustomerDTO>;
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

const gmPrisma = prisma as unknown as {
  generalMerchandiseCustomer: {
    findMany: (args: unknown) => Promise<unknown[]>;
    upsert: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown | null>;
    update: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
};

export const generalMerchandiseCustomerService: CustomerService = {
  async findActive() {
    const customers = (await gmPrisma.generalMerchandiseCustomer.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    })) as CustomerModel[];
    return customers.map((customer) => mapToDTO(customer));
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
            await (
              tx as unknown as typeof gmPrisma
            ).generalMerchandiseCustomer.upsert({
              where: { id: customer.id },
              create: createData,
              update: updateData,
            });
            updatedCount++;
            continue;
          }

          const existing = (await (
            tx as unknown as typeof gmPrisma
          ).generalMerchandiseCustomer.findFirst({
            where: { customerName: createData.customerName },
          })) as CustomerModel | null;

          if (existing) {
            await (
              tx as unknown as typeof gmPrisma
            ).generalMerchandiseCustomer.update({
              where: { id: existing.id },
              data: updateData,
            });
            updatedCount++;
          } else {
            await (
              tx as unknown as typeof gmPrisma
            ).generalMerchandiseCustomer.create({ data: createData });
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
    const created = (await gmPrisma.generalMerchandiseCustomer.create({
      data: mapFromDTO(customer),
    })) as CustomerModel;
    return mapToDTO(created);
  },

  async softDeleteAll() {
    const alreadyDeleted = await gmPrisma.generalMerchandiseCustomer.count({
      where: { deletedAt: { not: null } },
    });

    const result = await gmPrisma.generalMerchandiseCustomer.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return { deleted: result.count, alreadyDeleted };
  },
};

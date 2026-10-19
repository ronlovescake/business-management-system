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

const gmPrisma = prisma as {
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

export async function ensureGeneralMerchandiseCustomerForClothingId(
  clothingCustomerId: number
) {
  const clothingCustomer = await prisma.customer.findUnique({
    where: { id: clothingCustomerId },
  });

  if (!clothingCustomer || clothingCustomer.deletedAt) {
    return null;
  }

  const customerData = {
    date: clothingCustomer.date,
    customerName: clothingCustomer.customerName,
    phoneNumber: clothingCustomer.phoneNumber,
    address: clothingCustomer.address,
    facebook: clothingCustomer.facebook,
    emailAddress: clothingCustomer.emailAddress,
    businessName: clothingCustomer.businessName,
    taxNumber: clothingCustomer.taxNumber,
    businessAddress: clothingCustomer.businessAddress,
    businessContactNumber: clothingCustomer.businessContactNumber,
    customerStatus: clothingCustomer.customerStatus,
  };

  const linkedCustomer = await prisma.generalMerchandiseCustomer.findUnique({
    where: { clothingCustomerId },
  });

  if (linkedCustomer) {
    return prisma.generalMerchandiseCustomer.update({
      where: { id: linkedCustomer.id },
      data: { ...customerData, deletedAt: null },
    });
  }

  const sameNameCustomers = await prisma.generalMerchandiseCustomer.findMany({
    where: { customerName: clothingCustomer.customerName },
    select: { id: true, clothingCustomerId: true },
  });

  if (sameNameCustomers.length > 1) {
    throw new Error(
      `Multiple GM customer records match Clothing customer ${clothingCustomerId}`
    );
  }

  const sameNameCustomer = sameNameCustomers[0];
  if (
    sameNameCustomer &&
    sameNameCustomer.clothingCustomerId !== null &&
    sameNameCustomer.clothingCustomerId !== clothingCustomerId
  ) {
    throw new Error(
      `GM customer name is already linked to another Clothing customer`
    );
  }

  if (sameNameCustomer) {
    return prisma.generalMerchandiseCustomer.update({
      where: { id: sameNameCustomer.id },
      data: {
        ...customerData,
        clothingCustomer: { connect: { id: clothingCustomerId } },
        deletedAt: null,
      },
    });
  }

  return prisma.generalMerchandiseCustomer.create({
    data: {
      ...customerData,
      clothingCustomer: { connect: { id: clothingCustomerId } },
    },
  });
}

export async function findGeneralMerchandiseCustomerForClothingId(
  clothingCustomerId: number
) {
  const customer = await prisma.generalMerchandiseCustomer.findUnique({
    where: { clothingCustomerId },
  });

  return customer?.deletedAt ? null : customer;
}

export async function ensureGeneralMerchandiseCustomersForNames(
  customerNames: string[]
): Promise<Map<string, number>> {
  const names = Array.from(new Set(customerNames.filter(Boolean)));
  if (names.length === 0) {
    return new Map();
  }

  const clothingCustomers = await prisma.customer.findMany({
    where: { customerName: { in: names }, deletedAt: null },
    select: { id: true, customerName: true },
  });
  const customersByName = new Map<string, typeof clothingCustomers>();

  for (const customer of clothingCustomers) {
    const matches = customersByName.get(customer.customerName) ?? [];
    matches.push(customer);
    customersByName.set(customer.customerName, matches);
  }

  const customerIds = new Map<string, number>();
  const customerEntries = Array.from(customersByName.entries());
  for (let index = 0; index < customerEntries.length; index += 1) {
    const [name, matches] = customerEntries[index];
    if (matches.length !== 1) {
      continue;
    }

    const gmCustomer = await ensureGeneralMerchandiseCustomerForClothingId(
      matches[0].id
    );
    if (gmCustomer) {
      customerIds.set(name, gmCustomer.id);
    }
  }

  return customerIds;
}

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
            await (tx as typeof gmPrisma).generalMerchandiseCustomer.upsert({
              where: { id: customer.id },
              create: createData,
              update: updateData,
            });
            updatedCount++;
            continue;
          }

          const existing = (await (
            tx as typeof gmPrisma
          ).generalMerchandiseCustomer.findFirst({
            where: { customerName: createData.customerName },
          })) as CustomerModel | null;

          if (existing) {
            await (tx as typeof gmPrisma).generalMerchandiseCustomer.update({
              where: { id: existing.id },
              data: updateData,
            });
            updatedCount++;
          } else {
            await (tx as typeof gmPrisma).generalMerchandiseCustomer.create({
              data: createData,
            });
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

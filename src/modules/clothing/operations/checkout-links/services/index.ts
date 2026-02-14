import { logger } from '@/lib/logger';
import type { CheckoutLink } from '@prisma/client';
import type {
  CreateCheckoutLinksInput,
  UpdateCheckoutLinksInput,
} from '../api/schemas';
import { checkoutLinksRepository } from './repository';

type CheckoutLinksRepositoryLike = {
  findAll: (options?: Record<string, unknown>) => Promise<CheckoutLink[]>;
  findById: (id: string) => Promise<CheckoutLink | null>;
  create: (
    data: Omit<CheckoutLink, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<CheckoutLink>;
  update: (
    id: string,
    data: Partial<Omit<CheckoutLink, 'id' | 'createdAt'>>
  ) => Promise<CheckoutLink>;
  delete: (
    id: string,
    options?: { soft?: boolean }
  ) => Promise<CheckoutLink | void>;
};

export class CheckoutLinksService {
  constructor(private readonly repository: CheckoutLinksRepositoryLike) {}

  async findAll(): Promise<CheckoutLink[]> {
    logger.info('CheckoutLinks: Finding all');
    return this.repository.findAll({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: number | string): Promise<CheckoutLink | null> {
    logger.info('CheckoutLinks: Finding by ID', { id });
    return this.repository.findById(String(id));
  }

  async create(data: CreateCheckoutLinksInput): Promise<CheckoutLink> {
    logger.info('CheckoutLinks: Creating');
    return this.repository.create({
      ...data,
      checkoutLinks: data.checkoutLinks ?? null,
      productPortals: data.productPortals ?? null,
      productNames: data.productNames ?? null,
      deletedAt: null,
    });
  }

  async update(
    id: number | string,
    data: UpdateCheckoutLinksInput
  ): Promise<CheckoutLink> {
    logger.info('CheckoutLinks: Updating', { id });
    const normalizedData: Partial<Omit<CheckoutLink, 'id' | 'createdAt'>> = {
      ...data,
    };

    if ('checkoutLinks' in data) {
      normalizedData.checkoutLinks = data.checkoutLinks ?? null;
    }
    if ('productPortals' in data) {
      normalizedData.productPortals = data.productPortals ?? null;
    }
    if ('productNames' in data) {
      normalizedData.productNames = data.productNames ?? null;
    }

    return this.repository.update(String(id), normalizedData);
  }

  async delete(id: number | string): Promise<void> {
    logger.info('CheckoutLinks: Deleting', { id });
    await this.repository.delete(String(id), { soft: true });
  }
}

export const checkoutLinksService = new CheckoutLinksService(
  checkoutLinksRepository
);

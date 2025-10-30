/**
 * CheckoutLinks Repository
 */

import { BaseRepository } from '@/core/database';
import { prisma } from '@/lib/prisma';
import type { CheckoutLinks } from '../types';

class CheckoutLinksRepository extends BaseRepository<CheckoutLinks> {
  constructor() {
    super(prisma.checkoutLinks, 'CheckoutLinks');
  }

  /**
   * Add custom repository methods here
   */
}

export const checkoutLinksRepository = new CheckoutLinksRepository();

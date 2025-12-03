/**
 * CheckoutLinks Repository
 */

import { BaseRepository } from '@/core/database';
import { prisma } from '@/lib/db';
import type { CheckoutLink } from '@prisma/client';

class CheckoutLinksRepository extends BaseRepository<CheckoutLink> {
  constructor() {
    super(prisma.checkoutLink, 'CheckoutLink');
  }

  /**
   * Add custom repository methods here
   */
}

export const checkoutLinksRepository = new CheckoutLinksRepository();

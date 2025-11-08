/**
 * CheckoutLinks Repository
 */

import { BaseRepository } from '@/core/database';
import { prisma } from '@/lib/db';
import type { CheckoutLinks } from '../types';

class CheckoutLinksRepository extends BaseRepository<CheckoutLinks> {
  constructor() {
    super(prisma.checkoutLink, 'CheckoutLink');
  }

  /**
   * Add custom repository methods here
   */
}

export const checkoutLinksRepository = new CheckoutLinksRepository();

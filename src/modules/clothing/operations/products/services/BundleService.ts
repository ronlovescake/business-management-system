import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import type { BundleBatch, CreateBundleInput } from '../types/bundle.types';

export class BundleService {
  static async loadBundles(): Promise<BundleBatch[]> {
    try {
      const data = await api.get<BundleBatch[]>('/api/bundles');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      logger.error('Error loading bundles:', error);
      return [];
    }
  }

  static async createBundle(bundle: CreateBundleInput): Promise<BundleBatch> {
    return await api.post<BundleBatch>('/api/bundles', bundle);
  }
}

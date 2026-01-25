import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import type { BundleBatch, CreateBundleInput } from '../types/bundle.types';

export class BundleService {
  static async loadBundles(apiBasePath?: string): Promise<BundleBatch[]> {
    try {
      const data = await api.get<BundleBatch[]>(
        buildApiPath(apiBasePath, '/bundles')
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      logger.error('Error loading bundles:', error);
      return [];
    }
  }

  static async createBundle(
    bundle: CreateBundleInput,
    apiBasePath?: string
  ): Promise<BundleBatch> {
    return await api.post<BundleBatch>(
      buildApiPath(apiBasePath, '/bundles'),
      bundle
    );
  }

  static async updateBundle(
    bundle: CreateBundleInput & { id: number },
    apiBasePath?: string
  ): Promise<BundleBatch> {
    return await api.patch<BundleBatch>(
      buildApiPath(apiBasePath, '/bundles'),
      bundle
    );
  }

  static async deleteBundle(
    bundleId: number,
    apiBasePath?: string
  ): Promise<{ success: true }> {
    return await api.delete<{ success: true }>(
      `${buildApiPath(apiBasePath, '/bundles')}?id=${bundleId}`
    );
  }
}

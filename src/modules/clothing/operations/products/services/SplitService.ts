import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import type { SplitBatch, CreateSplitInput } from '../types/split.types';

export class SplitService {
  static async loadSplitBatches(apiBasePath?: string): Promise<SplitBatch[]> {
    try {
      const data = await api.get<SplitBatch[]>(
        buildApiPath(apiBasePath, '/split-batches')
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      logger.error('Error loading split batches:', error);
      return [];
    }
  }

  static async createSplitBatch(
    input: CreateSplitInput,
    apiBasePath?: string
  ): Promise<SplitBatch> {
    return await api.post<SplitBatch>(
      buildApiPath(apiBasePath, '/split-batches'),
      input
    );
  }

  static async updateSplitBatch(
    input: CreateSplitInput & { id: number },
    apiBasePath?: string
  ): Promise<SplitBatch> {
    return await api.patch<SplitBatch>(
      buildApiPath(apiBasePath, '/split-batches'),
      input
    );
  }

  static async deleteSplitBatch(
    id: number,
    apiBasePath?: string
  ): Promise<{ success: true }> {
    return await api.delete<{ success: true }>(
      `${buildApiPath(apiBasePath, '/split-batches')}?id=${id}`
    );
  }
}

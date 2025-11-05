import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';

export type OperationsNotificationCategory =
  | 'all'
  | 'transactions'
  | 'products'
  | 'prices'
  | 'shipments'
  | 'general';

export interface OperationsNotificationRecord {
  id: string;
  category: string;
  user: string | null;
  changes: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface FetchOperationsNotificationsParams {
  category?: OperationsNotificationCategory;
  limit?: number;
}

export interface CreateOperationsNotificationPayload {
  category?: OperationsNotificationCategory;
  user?: string;
  changes: string;
  metadata?: Record<string, unknown>;
}

const ENDPOINT = '/api/operations/notifications';
const OPERATIONS_USER_STORAGE_KEY = 'operations-active-user';

function resolveUserName(explicit?: string): string | undefined {
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(OPERATIONS_USER_STORAGE_KEY);
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }
  }

  return undefined;
}

function buildQueryString(
  params: FetchOperationsNotificationsParams = {}
): string {
  const searchParams = new URLSearchParams();

  if (params.category && params.category !== 'all') {
    searchParams.set('category', params.category);
  }

  if (params.limit) {
    searchParams.set('limit', String(params.limit));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export class OperationsNotificationsService {
  static async fetchList(
    params: FetchOperationsNotificationsParams = {}
  ): Promise<OperationsNotificationRecord[]> {
    const query = buildQueryString(params);
    try {
      return await api.get<OperationsNotificationRecord[]>(
        `${ENDPOINT}${query}`
      );
    } catch (error) {
      logger.error('Failed to fetch operations notifications:', error);
      throw error;
    }
  }

  static async log(
    payload: CreateOperationsNotificationPayload
  ): Promise<OperationsNotificationRecord> {
    const resolvedUser = resolveUserName(payload.user);

    try {
      return await api.post<OperationsNotificationRecord>(ENDPOINT, {
        ...payload,
        user: resolvedUser,
      });
    } catch (error) {
      logger.error('Failed to create operations notification:', error);
      throw error;
    }
  }
}

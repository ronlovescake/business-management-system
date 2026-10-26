import { api, ApiError } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { randomUuid } from '@/lib/utils/randomUuid';
import type { TransactionData } from '../types/transaction.types';
import { buildDraftCreatePayload } from './transactionOperationUtils';

export interface TransactionCreationRequest {
  key: string;
  payload?: ReturnType<typeof buildDraftCreatePayload>;
  mayHaveCommitted?: boolean;
}

export async function createDraftTransactionFromRow(
  draft: TransactionData,
  request: TransactionCreationRequest,
  apiBasePath?: string
): Promise<TransactionData> {
  request.payload ??= buildDraftCreatePayload(draft);
  try {
    const result = await api.post<{
      count: number;
      transactions?: TransactionData[];
    }>(
      buildApiPath(apiBasePath, '/transactions'),
      [{ ...request.payload, creationKey: request.key }],
      { retryEnabled: false }
    );
    const saved = result.transactions?.[0];
    if (
      result.count !== 1 ||
      result.transactions?.length !== 1 ||
      !saved?.id ||
      !saved.revision
    ) {
      throw new Error(
        'Missing creation acknowledgement. Retry the same draft to reconcile its saved identity.'
      );
    }
    return saved;
  } catch (error) {
    const rejected =
      error instanceof ApiError && [400, 404, 409, 422].includes(error.status);
    if (rejected && !request.mayHaveCommitted) {
      request.key = randomUuid();
      request.payload = undefined;
    } else {
      request.mayHaveCommitted = true;
    }
    throw error;
  }
}

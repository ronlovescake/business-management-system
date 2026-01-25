import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { buildApiPath } from '@/lib/api/paths';

interface StockCheckResponse {
  productCode: string;
  availableStock: number;
  requestedQuantity: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'INSUFFICIENT_STOCK' | 'SOLD_OUT';
  canFulfill: boolean;
  message: string;
}

interface UseStockCheckOptions {
  productCode: string;
  requestedQuantity?: number;
  enabled?: boolean;
  debounceMs?: number;
  apiBasePath?: string;
}

interface UseStockCheckResult {
  stockInfo: StockCheckResponse | null;
  isChecking: boolean;
  error: string | null;
  checkStock: () => Promise<void>;
}

/**
 * Hook to check product stock availability with debouncing
 */
export function useStockCheck({
  productCode,
  requestedQuantity = 0,
  enabled = true,
  debounceMs = 500,
  apiBasePath,
}: UseStockCheckOptions): UseStockCheckResult {
  const [stockInfo, setStockInfo] = useState<StockCheckResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStock = useCallback(async () => {
    if (!productCode?.trim()) {
      setStockInfo(null);
      setError(null);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch(
        buildApiPath(apiBasePath, '/inventory/check-stock'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productCode: productCode.trim(),
            requestedQuantity,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check stock');
      }

      const data = (await response.json()) as StockCheckResponse;
      setStockInfo(data);
    } catch (err) {
      logger.error('Stock check error:', err);
      setError('Failed to check stock availability');
      setStockInfo(null);
    } finally {
      setIsChecking(false);
    }
  }, [apiBasePath, productCode, requestedQuantity]);

  // Debounced stock check
  useEffect(() => {
    if (!enabled || !productCode?.trim()) {
      setStockInfo(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      void checkStock();
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [productCode, requestedQuantity, enabled, debounceMs, checkStock]);

  return {
    stockInfo,
    isChecking,
    error,
    checkStock,
  };
}

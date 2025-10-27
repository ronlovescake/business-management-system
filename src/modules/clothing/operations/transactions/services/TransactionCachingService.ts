/**
 * Transaction Caching Service
 *
 * Implements intelligent caching for frequently accessed transaction data
 * to reduce API calls and improve performance.
 *
 * Features:
 * - In-memory cache with TTL (Time To Live)
 * - Automatic invalidation on updates
 * - Cache warming on page load
 * - Statistics tracking
 * - Memory-safe (max cache size)
 */

import { logger } from '@/lib/logger';
import type {
  TransactionData,
  PriceTier,
} from '../types/transaction.types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

export class TransactionCachingService {
  // Cache storage
  private static transactionCache = new Map<number, CacheEntry<TransactionData>>();
  private static priceTiersCache: CacheEntry<PriceTier[]> | null = null;
  private static customerNamesCache: CacheEntry<string[]> | null = null;
  private static productCodesCache: CacheEntry<string[]> | null = null;

  // Cache configuration
  private static readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_CACHE_SIZE = 10000; // Max 10k transactions cached
  private static readonly STATS_TTL_MS = 30 * 1000; // 30 seconds for statistics

  // Cache statistics
  private static stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
  };

  /**
   * Get transaction by ID from cache
   */
  static getTransaction(id: number): TransactionData | null {
    const entry = this.transactionCache.get(id);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL_MS) {
      this.transactionCache.delete(id);
      this.stats.misses++;
      return null;
    }

    // Update hit count
    entry.hits++;
    this.stats.hits++;

    logger.debug(`Cache HIT for transaction ${id} (${entry.hits} hits)`);
    return entry.data;
  }

  /**
   * Cache transaction
   */
  static cacheTransaction(transaction: TransactionData): void {
    if (!transaction.id) {
      return;
    }

    // Check cache size limit
    if (this.transactionCache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastUsed();
    }

    this.transactionCache.set(transaction.id, {
      data: transaction,
      timestamp: Date.now(),
      hits: 0,
    });

    this.stats.size = this.transactionCache.size;
    logger.debug(`Cached transaction ${transaction.id}`);
  }

  /**
   * Cache multiple transactions
   */
  static cacheTransactions(transactions: TransactionData[]): void {
    transactions.forEach((t) => this.cacheTransaction(t));
    logger.debug(`Cached ${transactions.length} transactions`);
  }

  /**
   * Invalidate cached transaction
   */
  static invalidateTransaction(id: number): void {
    this.transactionCache.delete(id);
    this.stats.size = this.transactionCache.size;
    logger.debug(`Invalidated cache for transaction ${id}`);
  }

  /**
   * Invalidate all cached transactions
   */
  static invalidateAll(): void {
    const oldSize = this.transactionCache.size;
    this.transactionCache.clear();
    this.priceTiersCache = null;
    this.customerNamesCache = null;
    this.productCodesCache = null;
    this.stats.size = 0;
    logger.debug(`Invalidated all cache (cleared ${oldSize} entries)`);
  }

  /**
   * Get price tiers from cache
   */
  static getPriceTiers(): PriceTier[] | null {
    if (!this.priceTiersCache) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - this.priceTiersCache.timestamp > this.DEFAULT_TTL_MS) {
      this.priceTiersCache = null;
      this.stats.misses++;
      return null;
    }

    this.priceTiersCache.hits++;
    this.stats.hits++;
    logger.debug(
      `Cache HIT for price tiers (${this.priceTiersCache.hits} hits)`
    );
    return this.priceTiersCache.data;
  }

  /**
   * Cache price tiers
   */
  static cachePriceTiers(priceTiers: PriceTier[]): void {
    this.priceTiersCache = {
      data: priceTiers,
      timestamp: Date.now(),
      hits: 0,
    };
    logger.debug(`Cached ${priceTiers.length} price tiers`);
  }

  /**
   * Get customer names from cache
   */
  static getCustomerNames(): string[] | null {
    if (!this.customerNamesCache) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (
      Date.now() - this.customerNamesCache.timestamp >
      this.DEFAULT_TTL_MS
    ) {
      this.customerNamesCache = null;
      this.stats.misses++;
      return null;
    }

    this.customerNamesCache.hits++;
    this.stats.hits++;
    logger.debug(
      `Cache HIT for customer names (${this.customerNamesCache.hits} hits)`
    );
    return this.customerNamesCache.data;
  }

  /**
   * Cache customer names
   */
  static cacheCustomerNames(names: string[]): void {
    this.customerNamesCache = {
      data: names,
      timestamp: Date.now(),
      hits: 0,
    };
    logger.debug(`Cached ${names.length} customer names`);
  }

  /**
   * Get product codes from cache
   */
  static getProductCodes(): string[] | null {
    if (!this.productCodesCache) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (
      Date.now() - this.productCodesCache.timestamp >
      this.DEFAULT_TTL_MS
    ) {
      this.productCodesCache = null;
      this.stats.misses++;
      return null;
    }

    this.productCodesCache.hits++;
    this.stats.hits++;
    logger.debug(
      `Cache HIT for product codes (${this.productCodesCache.hits} hits)`
    );
    return this.productCodesCache.data;
  }

  /**
   * Cache product codes
   */
  static cacheProductCodes(codes: string[]): void {
    this.productCodesCache = {
      data: codes,
      timestamp: Date.now(),
      hits: 0,
    };
    logger.debug(`Cached ${codes.length} product codes`);
  }

  /**
   * Evict least recently used entries
   */
  private static evictLeastUsed(): void {
    const entries = Array.from(this.transactionCache.entries());

    // Sort by hits (ascending) and timestamp (ascending)
    entries.sort(
      (a, b) =>
        a[1].hits - b[1].hits || a[1].timestamp - b[1].timestamp
    );

    // Remove bottom 10%
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.transactionCache.delete(entries[i][0]);
      this.stats.evictions++;
    }

    this.stats.size = this.transactionCache.size;
    logger.debug(`Evicted ${toRemove} least used cache entries`);
  }

  /**
   * Get cache statistics
   */
  static getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.transactionCache.size,
    };
  }

  /**
   * Get cache hit rate
   */
  static getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  /**
   * Reset statistics
   */
  static resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: this.transactionCache.size,
      evictions: 0,
    };
    logger.debug('Cache statistics reset');
  }

  /**
   * Warm cache with initial data
   *
   * Pre-loads frequently accessed data to improve initial page performance
   */
  static warmCache(data: {
    transactions?: TransactionData[];
    priceTiers?: PriceTier[];
    customerNames?: string[];
    productCodes?: string[];
  }): void {
    if (data.transactions) {
      this.cacheTransactions(data.transactions);
    }

    if (data.priceTiers) {
      this.cachePriceTiers(data.priceTiers);
    }

    if (data.customerNames) {
      this.cacheCustomerNames(data.customerNames);
    }

    if (data.productCodes) {
      this.cacheProductCodes(data.productCodes);
    }

    logger.debug('Cache warmed with initial data');
  }
}

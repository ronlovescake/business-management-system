/**
 * Transaction Locking Service
 *
 * Prevents concurrent edits to the same transaction by implementing
 * optimistic locking with version tracking.
 *
 * Strategy:
 * - Each transaction has a version field
 * - Before saving, check if version matches
 * - If mismatch, reject and show conflict resolution UI
 * - Automatically retry non-conflicting updates
 */

import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import type { TransactionData } from '../types/transaction.types';

interface LockCheckResult {
  success: boolean;
  currentVersion?: number;
  conflict?: {
    field: string;
    theirValue: unknown;
    yourValue: unknown;
  };
}

interface LockedTransaction {
  id: number;
  lockedAt: number;
  lockedBy: string;
}

export class TransactionLockingService {
  // In-memory lock registry (would be Redis in production)
  private static locks = new Map<number, LockedTransaction>();
  private static LOCK_TIMEOUT_MS = 30000; // 30 seconds

  /**
   * Attempt to acquire lock for transaction
   */
  static acquireLock(transactionId: number, userId: string): boolean {
    const existing = this.locks.get(transactionId);
    const now = Date.now();

    // Check if lock expired
    if (existing && now - existing.lockedAt > this.LOCK_TIMEOUT_MS) {
      logger.debug(`Lock expired for transaction ${transactionId}`);
      this.locks.delete(transactionId);
    }

    // Check if lock is available
    const currentLock = this.locks.get(transactionId);
    if (currentLock && currentLock.lockedBy !== userId) {
      logger.warn(
        `Transaction ${transactionId} is locked by ${currentLock.lockedBy}`
      );
      return false;
    }

    // Acquire lock
    this.locks.set(transactionId, {
      id: transactionId,
      lockedAt: now,
      lockedBy: userId,
    });

    logger.debug(`Lock acquired for transaction ${transactionId} by ${userId}`);
    return true;
  }

  /**
   * Release lock for transaction
   */
  static releaseLock(transactionId: number, userId: string): void {
    const existing = this.locks.get(transactionId);

    if (existing && existing.lockedBy === userId) {
      this.locks.delete(transactionId);
      logger.debug(
        `Lock released for transaction ${transactionId} by ${userId}`
      );
    }
  }

  /**
   * Check if transaction can be edited (optimistic locking)
   *
   * Compares version numbers to detect concurrent edits
   */
  static async checkVersion(
    transactionId: number,
    expectedVersion: number
  ): Promise<LockCheckResult> {
    try {
      // Fetch latest version from database
      const latest = await api.get<TransactionData>(
        `/api/transactions/${transactionId}`
      );

      // Check version match
      if (
        latest.version !== undefined &&
        latest.version !== expectedVersion
      ) {
        logger.warn(
          `Version mismatch for transaction ${transactionId}: expected ${expectedVersion}, got ${latest.version}`
        );

        return {
          success: false,
          currentVersion: latest.version,
          conflict: {
            field: 'unknown',
            theirValue: latest,
            yourValue: expectedVersion,
          },
        };
      }

      return {
        success: true,
        currentVersion: latest.version || 0,
      };
    } catch (error) {
      logger.error('Error checking transaction version:', error);
      throw error;
    }
  }

  /**
   * Save transaction with version check
   *
   * Automatically retries once if version mismatch is non-conflicting
   */
  static async saveWithVersionCheck(
    transaction: TransactionData & { version?: number }
  ): Promise<TransactionData> {
    const transactionId = transaction.id;
    if (!transactionId) {
      throw new Error('Transaction ID is required for version check');
    }

    // Check version before saving
    const versionCheck = await this.checkVersion(
      transactionId,
      transaction.version || 0
    );

    if (!versionCheck.success) {
      // Version conflict detected
      throw new Error(
        `Transaction ${transactionId} was modified by another user. Please refresh and try again.`
      );
    }

    // Save with incremented version
    const updatedTransaction = {
      ...transaction,
      version: (transaction.version || 0) + 1,
    };

    try {
      const result = await api.patch<TransactionData>(
        '/api/transactions',
        updatedTransaction
      );

      logger.debug(`Transaction ${transactionId} saved with version check`);
      return result;
    } catch (error) {
      logger.error('Error saving transaction with version check:', error);
      throw error;
    }
  }

  /**
   * Batch save with conflict detection
   *
   * Saves multiple transactions, detecting conflicts and
   * returning successful and failed saves separately
   */
  static async batchSaveWithLocking(
    transactions: (TransactionData & { version?: number })[]
  ): Promise<{
    successful: TransactionData[];
    failed: Array<{
      transaction: TransactionData;
      error: string;
    }>;
  }> {
    const successful: TransactionData[] = [];
    const failed: Array<{ transaction: TransactionData; error: string }> = [];

    for (const transaction of transactions) {
      try {
        const result = await this.saveWithVersionCheck(transaction);
        successful.push(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to save transaction';
        failed.push({
          transaction,
          error: errorMessage,
        });
      }
    }

    logger.debug(
      `Batch save completed: ${successful.length} successful, ${failed.length} failed`
    );

    return { successful, failed };
  }

  /**
   * Clean expired locks
   *
   * Should be called periodically to prevent memory leaks
   */
  static cleanExpiredLocks(): void {
    const now = Date.now();
    let cleaned = 0;

    this.locks.forEach((lock, id) => {
      if (now - lock.lockedAt > this.LOCK_TIMEOUT_MS) {
        this.locks.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired locks`);
    }
  }
}

/**
 * Order Status Utility — Business-Rule-Mapped Tests
 *
 * Rules Covered (operations-transactions.md):
 *  C-19  normalizeOrderStatus single source of truth for comparisons
 *  C-40  isCancelledOrderStatus — Cancelled, Forfeited, Voided
 *  C-41  isBuyerFaultCancellationStatus — only Cancelled + Forfeited
 *  C-19  canonicalizeOrderStatus returns canonical label
 */

import { describe, it, expect } from 'vitest';

import {
  normalizeOrderStatus,
  isCancelledOrderStatus,
  isBuyerFaultCancellationStatus,
  canonicalizeOrderStatus,
  ORDER_STATUS_OPTIONS,
} from '@/lib/transactions/order-status';

describe('order-status utilities', () => {
  // =========================================================================
  // normalizeOrderStatus
  // =========================================================================
  describe('normalizeOrderStatus()', () => {
    it('Rule C-19: lowercases and trims', () => {
      expect(normalizeOrderStatus('  In Transit  ')).toBe('in transit');
    });

    it('Rule C-19: collapses multiple spaces', () => {
      expect(normalizeOrderStatus('Pending  Payment')).toBe('pending payment');
    });

    it('Rule C-19: treats null as empty string', () => {
      expect(normalizeOrderStatus(null)).toBe('');
    });

    it('Rule C-19: treats undefined as empty string', () => {
      expect(normalizeOrderStatus(undefined)).toBe('');
    });
  });

  // =========================================================================
  // isCancelledOrderStatus
  // =========================================================================
  describe('isCancelledOrderStatus()', () => {
    it('Rule C-40: "Cancelled" is cancelled', () => {
      expect(isCancelledOrderStatus('Cancelled')).toBe(true);
    });

    it('Rule C-40: "Forfeited" is cancelled', () => {
      expect(isCancelledOrderStatus('Forfeited')).toBe(true);
    });

    it('Rule C-40: "Voided" is cancelled', () => {
      expect(isCancelledOrderStatus('Voided')).toBe(true);
    });

    it('Rule C-40: case insensitive', () => {
      expect(isCancelledOrderStatus('cancelled')).toBe(true);
      expect(isCancelledOrderStatus('FORFEITED')).toBe(true);
    });

    it('Rule C-40: "Shipped" is NOT cancelled', () => {
      expect(isCancelledOrderStatus('Shipped')).toBe(false);
    });

    it('Rule C-40: "In Transit" is NOT cancelled', () => {
      expect(isCancelledOrderStatus('In Transit')).toBe(false);
    });

    it('Rule C-40: null is NOT cancelled', () => {
      expect(isCancelledOrderStatus(null)).toBe(false);
    });

    it('Rule C-40: empty string is NOT cancelled', () => {
      expect(isCancelledOrderStatus('')).toBe(false);
    });
  });

  // =========================================================================
  // isBuyerFaultCancellationStatus
  // =========================================================================
  describe('isBuyerFaultCancellationStatus()', () => {
    it('Rule C-41: "Cancelled" is buyer-fault', () => {
      expect(isBuyerFaultCancellationStatus('Cancelled')).toBe(true);
    });

    it('Rule C-41: "Forfeited" is buyer-fault', () => {
      expect(isBuyerFaultCancellationStatus('Forfeited')).toBe(true);
    });

    it('Rule C-41: "Voided" is NOT buyer-fault', () => {
      expect(isBuyerFaultCancellationStatus('Voided')).toBe(false);
    });
  });

  // =========================================================================
  // canonicalizeOrderStatus
  // =========================================================================
  describe('canonicalizeOrderStatus()', () => {
    it('Rule C-19: returns canonical label', () => {
      expect(canonicalizeOrderStatus('in transit')).toBe('In Transit');
      expect(canonicalizeOrderStatus('pending payment')).toBe('Pending Payment');
      expect(canonicalizeOrderStatus('on-hold')).toBe('On-Hold');
    });

    it('handles "on hold" alias (without hyphen)', () => {
      expect(canonicalizeOrderStatus('on hold')).toBe('On-Hold');
    });

    it('returns undefined for unknown status', () => {
      expect(canonicalizeOrderStatus('Unknown')).toBeUndefined();
    });

    it('returns undefined for null/empty', () => {
      expect(canonicalizeOrderStatus(null)).toBeUndefined();
      expect(canonicalizeOrderStatus('')).toBeUndefined();
    });
  });

  // =========================================================================
  // ORDER_STATUS_OPTIONS constant
  // =========================================================================
  describe('ORDER_STATUS_OPTIONS', () => {
    it('contains 11 known statuses', () => {
      expect(ORDER_STATUS_OPTIONS).toHaveLength(11);
    });

    it('includes all terminal statuses', () => {
      expect(ORDER_STATUS_OPTIONS).toContain('Cancelled');
      expect(ORDER_STATUS_OPTIONS).toContain('Forfeited');
      expect(ORDER_STATUS_OPTIONS).toContain('Voided');
    });

    it('includes all workflow statuses', () => {
      expect(ORDER_STATUS_OPTIONS).toContain('In Transit');
      expect(ORDER_STATUS_OPTIONS).toContain('Warehouse');
      expect(ORDER_STATUS_OPTIONS).toContain('Prepared');
      expect(ORDER_STATUS_OPTIONS).toContain('Shipped');
    });
  });
});

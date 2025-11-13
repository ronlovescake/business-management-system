import { describe, it, expect } from 'vitest';
import {
  extractProductCodeFromItemName,
  buildProductWeightMap,
  calculateCustomerActualWeight,
  formatWeightDisplay,
  type TransactionSummary,
  type ItemWeightSummary,
} from '../utils/invoiceWeight';

describe('invoice weight helpers', () => {
  describe('extractProductCodeFromItemName', () => {
    it('extracts the code inside parentheses', () => {
      expect(extractProductCodeFromItemName('Baby Socks (BS-101725)')).toBe(
        'BS-101725'
      );
    });

    it('returns uppercase fallback when no parentheses exist', () => {
      expect(extractProductCodeFromItemName('bs-101725')).toBe('BS-101725');
    });

    it('returns null for empty value', () => {
      expect(extractProductCodeFromItemName('')).toBeNull();
    });
  });

  describe('buildProductWeightMap', () => {
    it('builds map using unique product codes', () => {
      const itemWeights: ItemWeightSummary[] = [
        {
          itemName: 'Baby Socks (BS-101725)',
          approxWeightPerPiece: '0.01',
        },
        {
          itemName: 'Duplicate Entry (BS-101725)',
          approxWeightPerPiece: '0.02',
        },
        {
          itemName: 'Mickey Plush (MP-2024)',
          approxWeightPerPiece: 0.2,
        },
      ];

      const map = buildProductWeightMap(itemWeights);

      expect(map.get('BS-101725')).toBeCloseTo(0.01);
      expect(map.get('MP-2024')).toBeCloseTo(0.2);
      expect(map.size).toBe(2);
    });
  });

  describe('calculateCustomerActualWeight', () => {
    const weightMap = new Map<string, number>([
      ['BS-101725', 0.01],
      ['OMST-110725', 0.1],
      ['OMGOST-110725', 0.21],
    ]);

    const transactions: TransactionSummary[] = [
      {
        customerName: "Olie's Collection | Ces Obejas",
        productCode: 'BS-101725',
        quantity: 30,
        orderStatus: 'Warehouse',
      },
      {
        customerName: "Olie's Collection | Ces Obejas",
        productCode: 'OMST-110725',
        quantity: 2,
        orderStatus: 'Prepared',
      },
      {
        customerName: "Olie's Collection | Ces Obejas",
        productCode: 'BS-101725',
        quantity: 10,
        orderStatus: 'Warehouse - Packed',
      },
      {
        customerName: "Olie's Collection | Ces Obejas",
        productCode: 'OMGOST-110725',
        quantity: 1,
        orderStatus: 'Shipped',
      },
      {
        customerName: 'Other Customer',
        productCode: 'BS-101725',
        quantity: 10,
        orderStatus: 'Warehouse',
      },
    ];

    it('computes total weight using allowed statuses only', () => {
      const weight = calculateCustomerActualWeight({
        customerName: "Olie's Collection | Ces Obejas",
        transactions,
        weightMap,
      });

      // Warehouse: 30 * 0.01 = 0.3
      // Warehouse - Packed: 10 * 0.01 = 0.1
      // Prepared: 2 * 0.1 = 0.2
      // Shipped entry excluded
      expect(weight).toBeCloseTo(0.6);
    });

    it('returns zero for customers without transactions', () => {
      const weight = calculateCustomerActualWeight({
        customerName: 'Unknown',
        transactions,
        weightMap,
      });

      expect(weight).toBe(0);
    });
  });

  describe('formatWeightDisplay', () => {
    it('returns empty string for non-positive values', () => {
      expect(formatWeightDisplay(0)).toBe('');
      expect(formatWeightDisplay(-1)).toBe('');
    });

    it('formats weight with up to two decimal places', () => {
      expect(formatWeightDisplay(0.6)).toBe('0.6');
      expect(formatWeightDisplay(1.234)).toBe('1.23');
      expect(formatWeightDisplay(2)).toBe('2');
    });
  });
});

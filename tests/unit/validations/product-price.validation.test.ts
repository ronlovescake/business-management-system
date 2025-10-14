import { describe, it, expect } from 'vitest';
import {
  validateProductData,
  validatePartialProductData,
  validateProductForm,
  validateBulkProducts,
  validateProductQuery,
  validatePriceTierData,
  validatePartialPriceTierData,
  validatePriceTierForm,
  validateBulkPriceTiers,
  validatePriceQuery,
  findPriceTierForQuantity,
  validatePriceTierConsistency,
  formatValidationErrors,
  type PriceTierDataInput,
} from '@/lib/validations/product-price.validation';

describe('Product and Price Validation', () => {
  describe('Product Validation', () => {
    describe('productDataSchema', () => {
      it('should validate a complete valid product', () => {
        const validProduct = {
          'Product Code': 'PROD-123',
          'Shipment Code': 'SHIP-001',
          'Ordered Quantity': 100,
          'Quantity per Dozen': 12,
          'Date Created': '2024-01-15',
        };

        const result = validateProductData(validProduct);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data['Product Code']).toBe('PROD-123');
          expect(result.data['Ordered Quantity']).toBe(100);
        }
      });

      it('should reject invalid product code format', () => {
        const invalidProduct = {
          'Product Code': 'INVALID@CODE!',
          'Shipment Code': 'SHIP-001',
          'Ordered Quantity': 100,
          'Quantity per Dozen': 12,
          'Date Created': '2024-01-15',
        };

        const result = validateProductData(invalidProduct);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Product code must contain only');
        }
      });

      it('should reject negative quantity', () => {
        const invalidProduct = {
          'Product Code': 'PROD-123',
          'Shipment Code': 'SHIP-001',
          'Ordered Quantity': -5,
          'Quantity per Dozen': 12,
          'Date Created': '2024-01-15',
        };

        const result = validateProductData(invalidProduct);
        expect(result.success).toBe(false);
      });

      it('should reject quantity exceeding 1,000,000', () => {
        const invalidProduct = {
          'Product Code': 'PROD-123',
          'Shipment Code': 'SHIP-001',
          'Ordered Quantity': 1000001,
          'Quantity per Dozen': 12,
          'Date Created': '2024-01-15',
        };

        const result = validateProductData(invalidProduct);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('cannot exceed 1,000,000');
        }
      });

      it('should accept valid date formats', () => {
        const dateFormats = ['2024-01-15', '2024-01-15T10:30:00.000Z', ''];

        dateFormats.forEach((date) => {
          const product = {
            'Product Code': 'PROD-123',
            'Shipment Code': 'SHIP-001',
            'Ordered Quantity': 100,
            'Quantity per Dozen': 12,
            'Date Created': date,
          };

          const result = validateProductData(product);
          expect(result.success).toBe(true);
        });
      });
    });

    describe('partialProductDataSchema', () => {
      it('should validate partial product data for updates', () => {
        const partialData = {
          'Ordered Quantity': 150,
          'Shipment Code': 'SHIP-002',
        };

        const result = validatePartialProductData(partialData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data['Ordered Quantity']).toBe(150);
        }
      });
    });

    describe('productFormSchema', () => {
      it('should validate product form with camelCase fields', () => {
        const formData = {
          productCode: 'PROD-123',
          shipmentCode: 'SHIP-001',
          orderedQuantity: 100,
          quantityPerDozen: 12,
          dateCreated: '2024-01-15',
        };

        const result = validateProductForm(formData);
        expect(result.success).toBe(true);
      });
    });

    describe('bulkProductSchema', () => {
      it('should validate array of products for bulk import', () => {
        const bulkData = [
          {
            'Product Code': 'PROD-001',
            'Shipment Code': 'SHIP-001',
            'Ordered Quantity': 100,
            'Quantity per Dozen': 12,
            'Date Created': '2024-01-15',
          },
          {
            'Product Code': 'PROD-002',
            'Shipment Code': 'SHIP-001',
            'Ordered Quantity': 200,
            'Quantity per Dozen': 12,
            'Date Created': '2024-01-16',
          },
        ];

        const result = validateBulkProducts(bulkData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBe(2);
        }
      });

      it('should reject empty array for bulk import', () => {
        const result = validateBulkProducts([]);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('At least one product is required');
        }
      });

      it('should reject bulk import exceeding 50,000 products', () => {
        const bulkData = new Array(50001).fill({
          'Product Code': 'PROD-001',
          'Shipment Code': 'SHIP-001',
          'Ordered Quantity': 100,
          'Quantity per Dozen': 12,
          'Date Created': '2024-01-15',
        });

        const result = validateBulkProducts(bulkData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('cannot exceed 50,000');
        }
      });
    });

    describe('productQuerySchema', () => {
      it('should validate query parameters', () => {
        const query = {
          page: '1',
          limit: '50',
          search: 'PROD',
          sortBy: 'Product Code',
          sortOrder: 'asc',
        };

        const result = validateProductQuery(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(1);
          expect(result.data.limit).toBe(50);
        }
      });
    });
  });

  describe('Price Tier Validation', () => {
    describe('priceTierDataSchema', () => {
      it('should validate a complete valid price tier', () => {
        const validTier = {
          'Product Code': 'PROD-123',
          'Lower Limit': 0,
          'Upper Limit': 100,
          Prices: 50.50,
        };

        const result = validatePriceTierData(validTier);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data['Product Code']).toBe('PROD-123');
          expect(result.data.Prices).toBe(50.50);
        }
      });

      it('should reject upper limit less than lower limit', () => {
        const invalidTier = {
          'Product Code': 'PROD-123',
          'Lower Limit': 100,
          'Upper Limit': 50,
          Prices: 50.00,
        };

        const result = validatePriceTierData(invalidTier);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Upper limit must be greater than or equal to lower limit');
        }
      });

      it('should reject both limits being zero', () => {
        const invalidTier = {
          'Product Code': 'PROD-123',
          'Lower Limit': 0,
          'Upper Limit': 0,
          Prices: 50.00,
        };

        const result = validatePriceTierData(invalidTier);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Both limits cannot be zero');
        }
      });

      it('should reject negative prices', () => {
        const invalidTier = {
          'Product Code': 'PROD-123',
          'Lower Limit': 0,
          'Upper Limit': 100,
          Prices: -10.00,
        };

        const result = validatePriceTierData(invalidTier);
        expect(result.success).toBe(false);
      });

      it('should reject prices with more than 2 decimal places', () => {
        const invalidTier = {
          'Product Code': 'PROD-123',
          'Lower Limit': 0,
          'Upper Limit': 100,
          Prices: 50.123,
        };

        const result = validatePriceTierData(invalidTier);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('at most 2 decimal places');
        }
      });

      it('should accept prices with 0, 1, or 2 decimal places', () => {
        const validPrices = [50, 50.5, 50.55];

        validPrices.forEach((price) => {
          const tier = {
            'Product Code': 'PROD-123',
            'Lower Limit': 0,
            'Upper Limit': 100,
            Prices: price,
          };

          const result = validatePriceTierData(tier);
          expect(result.success).toBe(true);
        });
      });

      it('should reject prices exceeding 1,000,000', () => {
        const invalidTier = {
          'Product Code': 'PROD-123',
          'Lower Limit': 0,
          'Upper Limit': 100,
          Prices: 1000001,
        };

        const result = validatePriceTierData(invalidTier);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('cannot exceed 1,000,000');
        }
      });
    });

    describe('partialPriceTierDataSchema', () => {
      it('should validate partial price tier data for updates', () => {
        const partialData = {
          Prices: 75.00,
        };

        const result = validatePartialPriceTierData(partialData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.Prices).toBe(75.00);
        }
      });
    });

    describe('priceTierFormSchema', () => {
      it('should validate price tier form with camelCase fields', () => {
        const formData = {
          productCode: 'PROD-123',
          lowerLimit: 0,
          upperLimit: 100,
          prices: 50.00,
        };

        const result = validatePriceTierForm(formData);
        expect(result.success).toBe(true);
      });

      it('should reject form with upper limit less than lower limit', () => {
        const formData = {
          productCode: 'PROD-123',
          lowerLimit: 100,
          upperLimit: 50,
          prices: 50.00,
        };

        const result = validatePriceTierForm(formData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Upper limit must be greater than or equal to lower limit');
        }
      });
    });

    describe('bulkPriceTierSchema', () => {
      it('should validate array of price tiers for bulk import', () => {
        const bulkData = [
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 0,
            'Upper Limit': 99,
            Prices: 50.00,
          },
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 100,
            'Upper Limit': 199,
            Prices: 45.00,
          },
        ];

        const result = validateBulkPriceTiers(bulkData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBe(2);
        }
      });

      it('should reject overlapping quantity ranges for same product', () => {
        const bulkData = [
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 0,
            'Upper Limit': 100,
            Prices: 50.00,
          },
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 50,
            'Upper Limit': 150,
            Prices: 45.00,
          },
        ];

        const result = validateBulkPriceTiers(bulkData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('overlapping quantity ranges');
        }
      });

      it('should accept overlapping ranges for different products', () => {
        const bulkData = [
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 0,
            'Upper Limit': 100,
            Prices: 50.00,
          },
          {
            'Product Code': 'PROD-002',
            'Lower Limit': 0,
            'Upper Limit': 100,
            Prices: 45.00,
          },
        ];

        const result = validateBulkPriceTiers(bulkData);
        expect(result.success).toBe(true);
      });

      it('should reject empty array for bulk import', () => {
        const result = validateBulkPriceTiers([]);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('At least one price tier is required');
        }
      });
    });

    describe('priceQuerySchema', () => {
      it('should validate query parameters', () => {
        const query = {
          page: '1',
          limit: '50',
          search: 'PROD',
          minPrice: '10.50',
          maxPrice: '100.00',
          sortBy: 'Prices',
          sortOrder: 'asc',
        };

        const result = validatePriceQuery(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(1);
          expect(result.data.minPrice).toBe(10.50);
          expect(result.data.maxPrice).toBe(100.00);
        }
      });
    });
  });

  describe('Utility Functions', () => {
    describe('findPriceTierForQuantity', () => {
      const priceTiers: PriceTierDataInput[] = [
        {
          'Product Code': 'PROD-001',
          'Lower Limit': 0,
          'Upper Limit': 99,
          Prices: 50.00,
        },
        {
          'Product Code': 'PROD-001',
          'Lower Limit': 100,
          'Upper Limit': 199,
          Prices: 45.00,
        },
        {
          'Product Code': 'PROD-001',
          'Lower Limit': 200,
          'Upper Limit': 999,
          Prices: 40.00,
        },
        {
          'Product Code': 'PROD-002',
          'Lower Limit': 0,
          'Upper Limit': 100,
          Prices: 30.00,
        },
      ];

      it('should find correct tier for quantity within range', () => {
        const tier = findPriceTierForQuantity(priceTiers, 'PROD-001', 50);
        expect(tier).not.toBeNull();
        if (tier) {
          expect(tier.Prices).toBe(50.00);
        }
      });

      it('should find correct tier for quantity at edge of range', () => {
        const tier = findPriceTierForQuantity(priceTiers, 'PROD-001', 100);
        expect(tier).not.toBeNull();
        if (tier) {
          expect(tier.Prices).toBe(45.00);
        }
      });

      it('should return null for quantity outside all ranges', () => {
        const tier = findPriceTierForQuantity(priceTiers, 'PROD-001', 1500);
        expect(tier).toBeNull();
      });

      it('should return null for non-existent product code', () => {
        const tier = findPriceTierForQuantity(priceTiers, 'PROD-999', 50);
        expect(tier).toBeNull();
      });

      it('should find tier for different product', () => {
        const tier = findPriceTierForQuantity(priceTiers, 'PROD-002', 50);
        expect(tier).not.toBeNull();
        if (tier) {
          expect(tier.Prices).toBe(30.00);
        }
      });
    });

    describe('validatePriceTierConsistency', () => {
      it('should detect gaps in quantity coverage', () => {
        const tiers: PriceTierDataInput[] = [
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 0,
            'Upper Limit': 50,
            Prices: 50.00,
          },
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 100,
            'Upper Limit': 200,
            Prices: 45.00,
          },
        ];

        const result = validatePriceTierConsistency(tiers);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('gap in quantity coverage');
        }
      });

      it('should accept continuous coverage', () => {
        const tiers: PriceTierDataInput[] = [
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 0,
            'Upper Limit': 50,
            Prices: 50.00,
          },
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 51,
            'Upper Limit': 100,
            Prices: 45.00,
          },
        ];

        const result = validatePriceTierConsistency(tiers);
        expect(result.success).toBe(true);
      });

      it('should accept gaps between different products', () => {
        const tiers: PriceTierDataInput[] = [
          {
            'Product Code': 'PROD-001',
            'Lower Limit': 0,
            'Upper Limit': 50,
            Prices: 50.00,
          },
          {
            'Product Code': 'PROD-002',
            'Lower Limit': 100,
            'Upper Limit': 200,
            Prices: 45.00,
          },
        ];

        const result = validatePriceTierConsistency(tiers);
        expect(result.success).toBe(true);
      });
    });

    describe('formatValidationErrors', () => {
      it('should format Zod errors into user-friendly messages', () => {
        const invalidData = {
          'Product Code': 'INVALID@CODE',
          'Shipment Code': '',
          'Ordered Quantity': -5,
        };

        const result = validateProductData(invalidData);
        expect(result.success).toBe(false);

        if (!result.success) {
          const formatted = formatValidationErrors(result.error);
          expect(typeof formatted).toBe('object');
          expect(Object.keys(formatted).length).toBeGreaterThan(0);
        }
      });
    });
  });
});

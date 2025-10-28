'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PriceFormData, PriceData } from '../types/price.types';
import { PriceService } from '../services/PriceService';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';

/**
 * Custom hook for managing price form state and operations
 */
export function usePriceForm() {
  // Form state
  const [form, setForm] = useState<PriceFormData>(
    PriceService.createEmptyForm()
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PriceData | null>(null);
  const [productCodeOptions, setProductCodeOptions] = useState<string[]>([]);

  /**
   * Fetch product codes for dropdown
   * Excludes product codes that already have prices
   */
  const fetchProductCodes = useCallback(async () => {
    try {
      // Fetch all products
      const products = await api.get<Array<Record<string, unknown>>>('/api/products');
      
      // Fetch existing prices to filter out product codes that already have prices
      const prices = await api.get<PriceData[]>('/api/prices');
      const existingProductCodes = new Set(
        prices.map((p) => p['Product Code'])
      );
      
      // Filter out product codes that already have prices
      const codes = products
        .map((p) => p['Product Code'] as string)
        .filter(Boolean)
        .filter((code) => !existingProductCodes.has(code))
        .sort();
      
      setProductCodeOptions(codes);
      logger.info(`Fetched ${codes.length} available product codes (${existingProductCodes.size} already priced)`);
    } catch (error) {
      logger.error('Failed to fetch product codes:', error);
      setProductCodeOptions([]);
    }
  }, []);

  /**
   * Fetch product codes on mount
   */
  useEffect(() => {
    fetchProductCodes();
  }, [fetchProductCodes]);

  /**
   * Reset form to empty state
   */
  const resetForm = useCallback(() => {
    setForm(PriceService.createEmptyForm());
  }, []);

  /**
   * Fetch product by product code and auto-populate price
   * Logic:
   * - Find the highest tier with a lower limit > 0 (the "active" tier)
   * - Set that tier's price to the actual price
   * - Set each tier above it to actual price + (₱5 * number of tiers down)
   * Example: If Tier 2 is active:
   *   - Tier 2 = Actual Price
   *   - Tier 1 = Actual Price + ₱5
   */
  const fetchProductAndPopulatePrice = useCallback(async (productCode: string) => {
    if (!productCode.trim()) {
      return;
    }

    try {
      // Fetch all products
      const products = await api.get<Array<Record<string, unknown>>>('/api/products');
      
      // Find the product by product code
      const product = products.find(
        (p) => p['Product Code'] === productCode.trim()
      );

      if (product && product['Actual Price']) {
        const actualPrice = Number(product['Actual Price']) || 0;
        
        // Auto-populate prices based on filled tiers
        setForm((prev) => {
          const newTiers = [...prev.tiers];
          
          // Find the highest tier with lower limit > 0
          let highestFilledTierIndex = -1;
          for (let i = newTiers.length - 1; i >= 0; i--) {
            if (newTiers[i].lowerLimit > 0) {
              highestFilledTierIndex = i;
              break;
            }
          }
          
          // If no tier has lower limit, default to Tier 1 (index 0)
          if (highestFilledTierIndex === -1) {
            highestFilledTierIndex = 0;
          }
          
          // Set the highest filled tier to actual price
          newTiers[highestFilledTierIndex] = {
            ...newTiers[highestFilledTierIndex],
            price: actualPrice,
          };
          
          // Set each tier above it with +₱5 markup per tier
          for (let i = highestFilledTierIndex - 1; i >= 0; i--) {
            const tierDifference = highestFilledTierIndex - i;
            newTiers[i] = {
              ...newTiers[i],
              price: actualPrice + (5 * tierDifference),
            };
          }
          
          logger.info(`Auto-populated prices for ${productCode} with highest tier at index ${highestFilledTierIndex}`);
          
          return {
            ...prev,
            tiers: newTiers,
          };
        });
      } else {
        logger.warn(`Product not found or has no actual price: ${productCode}`);
      }
    } catch (error) {
      logger.error('Failed to fetch product:', error);
    }
  }, []);

  /**
   * Update product code and fetch product data
   */
  const setProductCode = useCallback((productCode: string) => {
    setForm((prev) => ({
      ...prev,
      productCode,
    }));

    // Fetch product and auto-populate price when product code is entered
    if (productCode.trim()) {
      fetchProductAndPopulatePrice(productCode);
    }
  }, [fetchProductAndPopulatePrice]);

  /**
   * Update tier field
   */
  const updateTier = useCallback(
    (
      index: number,
      field: 'lowerLimit' | 'upperLimit' | 'price',
      value: number
    ) => {
      setForm((prev) => {
        const newTiers = [...prev.tiers];
        const numValue = value || 0;

        // Handle lower limit changes with auto-fill logic
        if (field === 'lowerLimit') {
          // Validation: Ensure this tier's lower limit is greater than previous tier's lower limit
          if (index > 0) {
            const previousLowerLimit = newTiers[index - 1]?.lowerLimit ?? 0;
            if (numValue > 0 && numValue <= previousLowerLimit) {
              // Don't update if the value is not greater than previous tier
              return prev;
            }
          }

          newTiers[index].lowerLimit = numValue;

          // Auto-fill logic based on tier
          if (index === 0 && numValue > 0) {
            // Tier 1: Auto-fill Upper Limit to 10,000
            newTiers[index].upperLimit = 10000;
          } else if (index === 1 && numValue > 0) {
            // Tier 2: Auto-fill its Upper Limit to 10,000
            newTiers[index].upperLimit = 10000;
            // Also update Tier 1's Upper Limit to be 1 less than Tier 2's Lower Limit
            newTiers[0].upperLimit = numValue - 1;
          } else if (index === 2 && numValue > 0) {
            // Tier 3: Auto-fill its Upper Limit to 10,000
            newTiers[index].upperLimit = 10000;
            // Also update Tier 2's Upper Limit to be 1 less than Tier 3's Lower Limit
            newTiers[1].upperLimit = numValue - 1;
          } else if (index === 3 && numValue > 0) {
            // Tier 4: Auto-fill its Upper Limit to 10,000
            newTiers[index].upperLimit = 10000;
            // Also update Tier 3's Upper Limit to be 1 less than Tier 4's Lower Limit
            newTiers[2].upperLimit = numValue - 1;
          }
          
          // After updating lower limit, recalculate prices if product code is set
          const updatedForm = {
            ...prev,
            tiers: newTiers,
          };
          
          // Trigger price recalculation after state update
          if (prev.productCode.trim()) {
            // Schedule the recalculation to happen after this state update
            setTimeout(() => {
              fetchProductAndPopulatePrice(prev.productCode);
            }, 0);
          }
          
          return updatedForm;
        } else {
          // For upperLimit and price, just update the field
          newTiers[index][field] = numValue;
        }

        return {
          ...prev,
          tiers: newTiers,
        };
      });
    },
    [fetchProductAndPopulatePrice]
  );

  /**
   * Update price adjustment
   */
  const setPriceAdjustment = useCallback((priceAdjustment: number) => {
    setForm((prev) => ({
      ...prev,
      priceAdjustment: priceAdjustment || 0,
    }));
  }, []);

  /**
   * Validate form
   */
  const validateForm = useCallback(() => {
    return PriceService.validatePrice(form);
  }, [form]);

  /**
   * Convert form to price data
   */
  const formToPriceData = useCallback(() => {
    return PriceService.formToPriceData(form);
  }, [form]);

  /**
   * Open add modal
   */
  const openAddModal = useCallback(() => {
    resetForm();
    setIsAddOpen(true);
    // Refresh product codes to ensure latest available list
    fetchProductCodes();
  }, [resetForm, fetchProductCodes]);

  /**
   * Close add modal
   */
  const closeAddModal = useCallback(() => {
    setIsAddOpen(false);
    resetForm();
  }, [resetForm]);

  /**
   * Open edit modal
   */
  const openEditModal = useCallback(
    (price: PriceData, allPricesForProduct: PriceData[]) => {
      setEditingPrice(price);

      // Sort by lower limit to get proper tier order
      allPricesForProduct.sort((a, b) => a['Lower Limit'] - b['Lower Limit']);

      // Pre-populate the form with existing data (up to 4 tiers)
      const tiers = [
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
      ];

      // Fill in the existing tiers
      allPricesForProduct.slice(0, 4).forEach((tier, index) => {
        tiers[index] = {
          lowerLimit: tier['Lower Limit'],
          upperLimit: tier['Upper Limit'],
          price: tier['Prices'],
        };
      });

      setForm({
        productCode: price['Product Code'],
        tiers: tiers,
        priceAdjustment: price['Price Adjustment'],
      });

      setIsEditOpen(true);
    },
    []
  );

  /**
   * Close edit modal
   */
  const closeEditModal = useCallback(() => {
    setIsEditOpen(false);
    setEditingPrice(null);
    resetForm();
  }, [resetForm]);

  return {
    // Form state
    form,
    setForm,

    // Modal state
    isAddOpen,
    isEditOpen,
    editingPrice,

    // Product codes
    productCodeOptions,
    fetchProductCodes,

    // Form fields
    setProductCode,
    updateTier,
    setPriceAdjustment,

    // Validation
    validateForm,
    formToPriceData,

    // Modal controls
    openAddModal,
    closeAddModal,
    openEditModal,
    closeEditModal,

    // Utility
    resetForm,
  };
}

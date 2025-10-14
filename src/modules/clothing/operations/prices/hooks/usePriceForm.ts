'use client';

import { useState, useCallback } from 'react';
import type { PriceFormData, PriceData } from '../types/price.types';
import { PriceService } from '../services/PriceService';

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

  /**
   * Reset form to empty state
   */
  const resetForm = useCallback(() => {
    setForm(PriceService.createEmptyForm());
  }, []);

  /**
   * Update product code
   */
  const setProductCode = useCallback((productCode: string) => {
    setForm((prev) => ({
      ...prev,
      productCode,
    }));
  }, []);

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
    []
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
  }, [resetForm]);

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

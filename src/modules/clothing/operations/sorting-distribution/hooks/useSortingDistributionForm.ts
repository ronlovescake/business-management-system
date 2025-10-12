'use client';

/**
 * Sorting Distribution Form Hook
 *
 * Manages form state for product selection and quantity selection.
 */

import { useState, useCallback } from 'react';
import { SortingDistributionService } from '../services/SortingDistributionService';
import { Product } from '../types/sortingDistribution.types';

export interface UseSortingDistributionFormReturn {
  // Form fields
  item: string;
  ordered: string;
  selectedQuantity: number | null;

  // Actions
  setItem: (item: string) => void;
  setOrdered: (ordered: string) => void;
  setSelectedQuantity: (quantity: number | null) => void;
  resetForm: () => void;
}

export interface UseSortingDistributionFormProps {
  allProducts: Product[];
}

/**
 * Hook for managing sorting distribution form state
 */
export function useSortingDistributionForm({
  allProducts,
}: UseSortingDistributionFormProps): UseSortingDistributionFormReturn {
  const [item, setItem] = useState<string>('');
  const [ordered, setOrdered] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number | null>(null);

  /**
   * Auto-populate ordered quantity when product is selected
   */
  const handleSetItem = useCallback(
    (productCode: string) => {
      setItem(productCode);

      if (productCode && allProducts.length > 0) {
        const totalQuantity =
          SortingDistributionService.getTotalQuantityForProduct(
            productCode,
            allProducts
          );
        console.log(`Total quantity for ${productCode}:`, totalQuantity);
        setOrdered(totalQuantity.toString());
      } else {
        setOrdered('');
      }

      // Reset selected quantity when product changes
      setSelectedQuantity(null);
    },
    [allProducts]
  );

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setItem('');
    setOrdered('');
    setSelectedQuantity(null);
  }, []);

  return {
    // Form fields
    item,
    ordered,
    selectedQuantity,

    // Actions
    setItem: handleSetItem,
    setOrdered,
    setSelectedQuantity,
    resetForm,
  };
}

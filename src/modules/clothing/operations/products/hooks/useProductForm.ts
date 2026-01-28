'use client';

/**
 * useProductForm Hook
 * Manages product form state and calculations
 */

import { useState, useMemo, useCallback } from 'react';
import type { ProductFormData, ProductData } from '../types/product.types';
import { ProductService } from '../services/ProductService';
import { calculateProductFinancials } from '@/lib/productCalculations';

export function useProductForm(initialProduct?: ProductData) {
  // Form state
  const [form, setForm] = useState<ProductFormData>(
    initialProduct
      ? ProductService.productToForm(initialProduct)
      : ProductService.createEmptyForm()
  );

  // Edit mode tracking
  const [isEditMode, setIsEditMode] = useState(!!initialProduct);
  const [editingProductId, setEditingProductId] = useState<number | null>(
    initialProduct?.id || null
  );

  /**
   * Update single form field
   */
  const updateField = useCallback(
    (field: keyof ProductFormData, value: unknown) => {
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  /**
   * Reset form to empty
   */
  const resetForm = useCallback(() => {
    setForm(ProductService.createEmptyForm());
    setIsEditMode(false);
    setEditingProductId(null);
  }, []);

  /**
   * Populate form with existing product (for edit mode)
   */
  const populateForm = useCallback((product: ProductData) => {
    setForm(ProductService.productToForm(product));
    setIsEditMode(true);
    setEditingProductId(product.id || null);
  }, []);

  /**
   * Calculate all financial metrics (memoized)
   */
  const calculations = useMemo(() => {
    return calculateProductFinancials({
      unitPrice: form.unitPrice,
      quantity: form.quantity,
      alibabaShippingCost: form.alibabaShippingCost,
      exchangeRates: form.exchangeRates,
      forwardersFee: form.forwardersFee,
      lalamove: form.lalamove,
      packagingCost: form.packagingCost,
      actualPrice: form.actualPrice,
      applyTransactionFee: form.applyTransactionFee,
      bulkWeight: form.bulkWeight,
      bulkQuantity: form.bulkQuantity,
    });
  }, [form]);

  /**
   * Validate form
   */
  const validate = useCallback(() => {
    return ProductService.validateProduct(form);
  }, [form]);

  /**
   * Convert form to ProductData
   */
  const toProductData = useCallback(
    (existingProduct?: ProductData): ProductData => {
      return ProductService.formToProductData(
        form,
        isEditMode,
        existingProduct
      );
    },
    [form, isEditMode]
  );

  return {
    // Form state
    form,
    isEditMode,
    editingProductId,
    calculations,

    // Actions
    updateField,
    resetForm,
    populateForm,
    validate,
    toProductData,
  };
}

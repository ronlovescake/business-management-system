'use client';

/**
 * useProductsData Hook
 * Manages product data state, loading, search, and statistics
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { ProductData, ProductStatistics } from '../types/product.types';
import { ProductService } from '../services/ProductService';

export function useProductsData(apiBasePath?: string) {
  const queryClient = useQueryClient();
  const productsQueryKey = useMemo(
    () => [...queryKeys.products.lists(), apiBasePath ?? 'default'],
    [apiBasePath]
  );

  // State
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce search query (300ms)
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

  /**
   * Load products with shipment integration using React Query
   */
  const {
    data: products = [],
    isLoading,
    refetch: refreshProducts,
  } = useQuery({
    queryKey: productsQueryKey,
    queryFn: async () => {
      try {
        return await ProductService.loadProducts(apiBasePath);
      } catch (error) {
        logger.error('Failed to load products:', error);
        return [];
      }
    },
    staleTime: 30 * 1000,
  });

  /**
   * Handle search input change
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Apply search filter (debounced)
   */
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return products;
    }
    return ProductService.searchProducts(products, debouncedSearch);
  }, [debouncedSearch, products]);

  /**
   * Calculate statistics (memoized)
   */
  const statistics = useMemo<ProductStatistics>(() => {
    return ProductService.calculateStatistics(filteredProducts);
  }, [filteredProducts]);

  /**
   * Add new product mutation
   */
  const addProductMutation = useMutation({
    mutationFn: async (product: ProductData) => {
      return await ProductService.addProduct(product, apiBasePath);
    },
    onMutate: async (newProduct) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: productsQueryKey });

      // Snapshot previous value
      const previousProducts =
        queryClient.getQueryData<ProductData[]>(productsQueryKey);

      // Optimistically update
      if (previousProducts) {
        queryClient.setQueryData<ProductData[]>(productsQueryKey, [
          newProduct,
          ...previousProducts,
        ]);
      }

      return { previousProducts };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(productsQueryKey, context.previousProducts);
      }
      logger.error('Failed to add product:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
    },
  });

  /**
   * Update existing product mutation
   */
  const updateProductMutation = useMutation({
    mutationFn: async ({
      productId,
      productData,
    }: {
      productId: number;
      productData: Partial<ProductData>;
    }) => {
      return await ProductService.updateProduct(
        productId,
        productData,
        apiBasePath
      );
    },
    onMutate: async ({ productId, productData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: productsQueryKey });

      // Snapshot previous value
      const previousProducts =
        queryClient.getQueryData<ProductData[]>(productsQueryKey);

      // Optimistically update
      if (previousProducts) {
        queryClient.setQueryData<ProductData[]>(
          productsQueryKey,
          previousProducts.map((p) =>
            p.id === productId ? { ...p, ...productData, id: productId } : p
          )
        );
      }

      return { previousProducts };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(productsQueryKey, context.previousProducts);
      }
      logger.error('Failed to update product:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
    },
  });

  /**
   * Bulk update products mutation
   */
  const bulkUpdateProductsMutation = useMutation({
    mutationFn: async (updatedProducts: ProductData[]) => {
      return await ProductService.bulkUpdateProducts(
        updatedProducts,
        apiBasePath
      );
    },
    onMutate: async (updatedProducts) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: productsQueryKey });

      // Snapshot previous value
      const previousProducts =
        queryClient.getQueryData<ProductData[]>(productsQueryKey);

      // Optimistically update
      queryClient.setQueryData<ProductData[]>(
        productsQueryKey,
        updatedProducts
      );

      return { previousProducts };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(productsQueryKey, context.previousProducts);
      }
      logger.error('Failed to bulk update products:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
    },
  });

  /**
   * Wrapper functions to maintain API compatibility
   */
  const addProduct = useCallback(
    async (product: ProductData) => {
      return await addProductMutation.mutateAsync(product);
    },
    [addProductMutation]
  );

  const updateProduct = useCallback(
    async (productId: number, productData: Partial<ProductData>) => {
      return await updateProductMutation.mutateAsync({
        productId,
        productData,
      });
    },
    [updateProductMutation]
  );

  const bulkUpdateProducts = useCallback(
    async (updatedProducts: ProductData[]) => {
      return await bulkUpdateProductsMutation.mutateAsync(updatedProducts);
    },
    [bulkUpdateProductsMutation]
  );

  return {
    // Data
    products,
    filteredProducts,
    searchQuery,
    statistics,
    isLoading,

    // Actions
    handleSearch,
    addProduct,
    updateProduct,
    bulkUpdateProducts,
    refreshProducts,
  };
}

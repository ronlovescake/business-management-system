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

export function useProductsData() {
  const queryClient = useQueryClient();

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
    queryKey: queryKeys.products.lists(),
    queryFn: async () => {
      try {
        return await ProductService.loadProducts();
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
      return await ProductService.addProduct(product);
    },
    onMutate: async (newProduct) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.products.lists() });

      // Snapshot previous value
      const previousProducts = queryClient.getQueryData<ProductData[]>(
        queryKeys.products.lists()
      );

      // Optimistically update
      if (previousProducts) {
        queryClient.setQueryData<ProductData[]>(
          queryKeys.products.lists(),
          [newProduct, ...previousProducts]
        );
      }

      return { previousProducts };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(
          queryKeys.products.lists(),
          context.previousProducts
        );
      }
      logger.error('Failed to add product:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
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
      return await ProductService.updateProduct(productId, productData);
    },
    onMutate: async ({ productId, productData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.products.lists() });

      // Snapshot previous value
      const previousProducts = queryClient.getQueryData<ProductData[]>(
        queryKeys.products.lists()
      );

      // Optimistically update
      if (previousProducts) {
        queryClient.setQueryData<ProductData[]>(
          queryKeys.products.lists(),
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
        queryClient.setQueryData(
          queryKeys.products.lists(),
          context.previousProducts
        );
      }
      logger.error('Failed to update product:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
  });

  /**
   * Bulk update products mutation
   */
  const bulkUpdateProductsMutation = useMutation({
    mutationFn: async (updatedProducts: ProductData[]) => {
      return await ProductService.bulkUpdateProducts(updatedProducts);
    },
    onMutate: async (updatedProducts) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.products.lists() });

      // Snapshot previous value
      const previousProducts = queryClient.getQueryData<ProductData[]>(
        queryKeys.products.lists()
      );

      // Optimistically update
      queryClient.setQueryData<ProductData[]>(
        queryKeys.products.lists(),
        updatedProducts
      );

      return { previousProducts };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(
          queryKeys.products.lists(),
          context.previousProducts
        );
      }
      logger.error('Failed to bulk update products:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
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

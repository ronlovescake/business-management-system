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
import { createOptimisticUpdateHandlers } from '@/lib/react-query/optimistic';
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
  const addProductOptimistic = createOptimisticUpdateHandlers<
    ProductData,
    ProductData
  >({
    queryClient,
    queryKey: productsQueryKey,
    updater: (previousProducts, newProduct) =>
      previousProducts ? [newProduct, ...previousProducts] : previousProducts,
  });

  const addProductMutation = useMutation({
    mutationFn: async (product: ProductData) => {
      return await ProductService.addProduct(product, apiBasePath);
    },
    onMutate: addProductOptimistic.onMutate,
    onError: (error, variables, context) => {
      addProductOptimistic.onError(error, variables, context);
      logger.error('Failed to add product:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
    },
  });

  /**
   * Update existing product mutation
   */
  const updateProductOptimistic = createOptimisticUpdateHandlers<
    ProductData,
    { productId: number; productData: Partial<ProductData> }
  >({
    queryClient,
    queryKey: productsQueryKey,
    updater: (previousProducts, { productId, productData }) =>
      previousProducts
        ? previousProducts.map((product) =>
            product.id === productId
              ? { ...product, ...productData, id: productId }
              : product
          )
        : previousProducts,
  });

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
    onMutate: updateProductOptimistic.onMutate,
    onError: (error, variables, context) => {
      updateProductOptimistic.onError(error, variables, context);
      logger.error('Failed to update product:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
    },
  });

  /**
   * Bulk update products mutation
   */
  const bulkUpdateProductsOptimistic = createOptimisticUpdateHandlers<
    ProductData,
    ProductData[]
  >({
    queryClient,
    queryKey: productsQueryKey,
    updater: (_previousProducts, updatedProducts) => updatedProducts,
  });

  const bulkUpdateProductsMutation = useMutation({
    mutationFn: async (updatedProducts: ProductData[]) => {
      return await ProductService.bulkUpdateProducts(
        updatedProducts,
        apiBasePath
      );
    },
    onMutate: bulkUpdateProductsOptimistic.onMutate,
    onError: (error, variables, context) => {
      bulkUpdateProductsOptimistic.onError(error, variables, context);
      logger.error('Failed to bulk update products:', error);
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

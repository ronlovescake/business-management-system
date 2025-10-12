'use client';

/**
 * useProductsData Hook
 * Manages product data state, loading, search, and statistics
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ProductData, ProductStatistics } from '../types/product.types';
import { ProductService } from '../services/ProductService';
import { useDebouncedValue } from '@mantine/hooks';

export function useProductsData() {
  // State
  const [products, setProducts] = useState<ProductData[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search query (300ms)
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

  /**
   * Load products with shipment integration
   */
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedProducts = await ProductService.loadProducts();
      setProducts(loadedProducts);
      setFilteredProducts(loadedProducts);
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
      setFilteredProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  /**
   * Apply search filter (debounced)
   */
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setFilteredProducts(products);
    } else {
      const filtered = ProductService.searchProducts(products, debouncedSearch);
      setFilteredProducts(filtered);
    }
  }, [debouncedSearch, products]);

  /**
   * Handle search input change
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Calculate statistics (memoized)
   */
  const statistics = useMemo<ProductStatistics>(() => {
    return ProductService.calculateStatistics(filteredProducts);
  }, [filteredProducts]);

  /**
   * Add new product
   */
  const addProduct = useCallback(
    async (product: ProductData) => {
      // Optimistic update
      const updatedProducts = [product, ...products];
      setProducts(updatedProducts);

      // Apply search filter if needed
      if (!searchQuery.trim()) {
        setFilteredProducts(updatedProducts);
      } else {
        const filtered = ProductService.searchProducts(
          updatedProducts,
          searchQuery
        );
        setFilteredProducts(filtered);
      }

      // Persist to database
      const result = await ProductService.addProduct(product);

      // Rollback on failure
      if (!result.success) {
        setProducts(products);
        if (!searchQuery.trim()) {
          setFilteredProducts(products);
        } else {
          const filtered = ProductService.searchProducts(products, searchQuery);
          setFilteredProducts(filtered);
        }
      }

      return result;
    },
    [products, searchQuery]
  );

  /**
   * Update existing product
   */
  const updateProduct = useCallback(
    async (productId: number, productData: Partial<ProductData>) => {
      // Optimistic update
      const updatedProducts = products.map((p) =>
        p.id === productId ? { ...p, ...productData, id: productId } : p
      );
      setProducts(updatedProducts);

      // Apply search filter if needed
      if (!searchQuery.trim()) {
        setFilteredProducts(updatedProducts);
      } else {
        const filtered = ProductService.searchProducts(
          updatedProducts,
          searchQuery
        );
        setFilteredProducts(filtered);
      }

      // Persist to database
      const result = await ProductService.updateProduct(productId, productData);

      // Rollback on failure
      if (!result.success) {
        setProducts(products);
        if (!searchQuery.trim()) {
          setFilteredProducts(products);
        } else {
          const filtered = ProductService.searchProducts(products, searchQuery);
          setFilteredProducts(filtered);
        }
      }

      return result;
    },
    [products, searchQuery]
  );

  /**
   * Bulk update products (for paste operations)
   */
  const bulkUpdateProducts = useCallback(
    async (updatedProducts: ProductData[]) => {
      // Optimistic update
      setProducts(updatedProducts);

      // Apply search filter if needed
      if (!searchQuery.trim()) {
        setFilteredProducts(updatedProducts);
      } else {
        const filtered = ProductService.searchProducts(
          updatedProducts,
          searchQuery
        );
        setFilteredProducts(filtered);
      }

      // Persist to database
      const result = await ProductService.bulkUpdateProducts(updatedProducts);

      // Rollback on failure
      if (!result.success) {
        setProducts(products);
        if (!searchQuery.trim()) {
          setFilteredProducts(products);
        } else {
          const filtered = ProductService.searchProducts(products, searchQuery);
          setFilteredProducts(filtered);
        }
      }

      return result;
    },
    [products, searchQuery]
  );

  /**
   * Refresh products
   */
  const refreshProducts = useCallback(() => {
    loadProducts();
  }, [loadProducts]);

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
    setProducts,
    setFilteredProducts,
  };
}

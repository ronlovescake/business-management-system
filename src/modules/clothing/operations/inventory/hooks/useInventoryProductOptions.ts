import { useMemo } from 'react';

type ProductRow = {
  'Product Code'?: string | null;
};

interface UseInventoryProductOptionsParams {
  products: ProductRow[];
  selectedProduct: string;
  normalizeProductCode: (value: string) => string;
}

export function useInventoryProductOptions({
  products,
  selectedProduct,
  normalizeProductCode,
}: UseInventoryProductOptionsParams) {
  const productOptions = useMemo(
    () =>
      products
        .map((product) => product['Product Code']?.trim())
        .filter(Boolean)
        .map((code) => ({ value: code as string, label: code as string })),
    [products]
  );

  const transferToOptions = useMemo(() => {
    const selectedCode = normalizeProductCode(selectedProduct);
    if (!selectedCode) {
      return productOptions;
    }

    return productOptions.filter(
      (option) => normalizeProductCode(option.value) !== selectedCode
    );
  }, [normalizeProductCode, productOptions, selectedProduct]);

  const productOptionValueByNormalizedCode = useMemo(() => {
    const map = new Map<string, string>();
    productOptions.forEach((option) => {
      const normalizedCode = normalizeProductCode(option.value);
      if (normalizedCode && !map.has(normalizedCode)) {
        map.set(normalizedCode, option.value);
      }
    });
    return map;
  }, [normalizeProductCode, productOptions]);

  return {
    productOptions,
    transferToOptions,
    productOptionValueByNormalizedCode,
  };
}

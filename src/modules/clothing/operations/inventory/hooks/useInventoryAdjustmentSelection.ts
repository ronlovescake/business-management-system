import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
} from 'react';

type AdjustmentBucket =
  | 'damaged_hold'
  | 'scrap'
  | 'supplier_short'
  | 'additionals';

interface UseInventoryAdjustmentSelectionParams {
  selectedProduct: string;
  searchQuery: string;
  singleFilteredProductCode: string | null;
  transferToProduct: string;
  getLatestBucketNote: (
    productCode: string,
    bucket: Exclude<AdjustmentBucket, 'additionals'>
  ) => string;
  getCurrentBucketQuantity: (
    productCode: string,
    bucket: AdjustmentBucket
  ) => number;
  getCurrentTransferQuantity: (
    sourceProductCode: string,
    destinationProductCode: string
  ) => number;
  normalizeProductCode: (value: string) => string;
  transferOutByProduct: {
    destinationsBySource: Map<
      string,
      Array<{ destinationCode: string; quantity: number }>
    >;
  };
  productOptionValueByNormalizedCode: Map<string, string>;
  setSelectedProduct: Dispatch<SetStateAction<string>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setNotes: Dispatch<SetStateAction<string>>;
  setPostingDate: Dispatch<SetStateAction<string>>;
  setTransferToProduct: Dispatch<SetStateAction<string>>;
  setTransferQty: Dispatch<SetStateAction<number | ''>>;
  setBucketQuantities: Dispatch<
    SetStateAction<Record<AdjustmentBucket, number | ''>>
  >;
  openAdjustmentModal: () => void;
}

export function useInventoryAdjustmentSelection({
  selectedProduct,
  searchQuery,
  singleFilteredProductCode,
  transferToProduct,
  getLatestBucketNote,
  getCurrentBucketQuantity,
  getCurrentTransferQuantity,
  normalizeProductCode,
  transferOutByProduct,
  productOptionValueByNormalizedCode,
  setSelectedProduct,
  setSearchQuery,
  setNotes,
  setPostingDate,
  setTransferToProduct,
  setTransferQty,
  setBucketQuantities,
  openAdjustmentModal,
}: UseInventoryAdjustmentSelectionParams) {
  const handleAdjustmentProductChange = useCallback(
    (value: string | null) => {
      const nextProductCode = (value ?? '').trim();
      setSelectedProduct(nextProductCode);
      setSearchQuery(nextProductCode);
      setTransferToProduct((previousProductCode) =>
        normalizeProductCode(previousProductCode) ===
        normalizeProductCode(nextProductCode)
          ? ''
          : previousProductCode
      );

      if (nextProductCode) {
        setNotes(getLatestBucketNote(nextProductCode, 'damaged_hold'));
      }
    },
    [
      getLatestBucketNote,
      normalizeProductCode,
      setNotes,
      setSearchQuery,
      setSelectedProduct,
      setTransferToProduct,
    ]
  );

  const openAdjustmentModalFromFilter = useCallback(() => {
    const defaultProductCode = singleFilteredProductCode || searchQuery.trim();

    if (defaultProductCode) {
      setSelectedProduct(defaultProductCode);
      setNotes(getLatestBucketNote(defaultProductCode, 'damaged_hold'));
    }

    setPostingDate(new Date().toISOString().slice(0, 10));
    setTransferToProduct('');
    setTransferQty(0);
    openAdjustmentModal();
  }, [
    getLatestBucketNote,
    openAdjustmentModal,
    searchQuery,
    setNotes,
    setPostingDate,
    setSelectedProduct,
    setTransferQty,
    setTransferToProduct,
    singleFilteredProductCode,
  ]);

  const openAdjustmentForProduct = useCallback(
    (productCode: string) => {
      const code = productCode.trim();
      if (!code) {
        return;
      }

      setSelectedProduct(code);
      setSearchQuery(code);
      setPostingDate(new Date().toISOString().slice(0, 10));
      setTransferToProduct('');
      setTransferQty(0);
      setNotes(getLatestBucketNote(code, 'damaged_hold'));
      openAdjustmentModal();
    },
    [
      getLatestBucketNote,
      openAdjustmentModal,
      setNotes,
      setPostingDate,
      setSearchQuery,
      setSelectedProduct,
      setTransferQty,
      setTransferToProduct,
    ]
  );

  const handleTransferToChange = useCallback(
    (value: string | null) => {
      const nextTransferToProduct = (value ?? '').trim();
      setTransferToProduct(nextTransferToProduct);

      if (!selectedProduct || !nextTransferToProduct) {
        setTransferQty(0);
        return;
      }

      setTransferQty(
        getCurrentTransferQuantity(selectedProduct, nextTransferToProduct)
      );
    },
    [
      getCurrentTransferQuantity,
      selectedProduct,
      setTransferQty,
      setTransferToProduct,
    ]
  );

  useEffect(() => {
    if (!selectedProduct) {
      setBucketQuantities({
        damaged_hold: 0,
        scrap: 0,
        supplier_short: 0,
        additionals: 0,
      });
      return;
    }

    setBucketQuantities({
      damaged_hold: getCurrentBucketQuantity(selectedProduct, 'damaged_hold'),
      scrap: getCurrentBucketQuantity(selectedProduct, 'scrap'),
      supplier_short: getCurrentBucketQuantity(
        selectedProduct,
        'supplier_short'
      ),
      additionals: getCurrentBucketQuantity(selectedProduct, 'additionals'),
    });
  }, [getCurrentBucketQuantity, selectedProduct, setBucketQuantities]);

  useEffect(() => {
    if (!selectedProduct) {
      setTransferToProduct('');
      setTransferQty(0);
      return;
    }

    setTransferToProduct((previousProductCode) =>
      normalizeProductCode(previousProductCode) ===
      normalizeProductCode(selectedProduct)
        ? ''
        : previousProductCode
    );
  }, [
    normalizeProductCode,
    selectedProduct,
    setTransferQty,
    setTransferToProduct,
  ]);

  useEffect(() => {
    const normalizedSourceProductCode = normalizeProductCode(selectedProduct);
    if (!normalizedSourceProductCode) {
      setTransferQty(0);
      return;
    }

    const normalizedDestinationProductCode =
      normalizeProductCode(transferToProduct);

    if (!normalizedDestinationProductCode) {
      const defaultDestination = transferOutByProduct.destinationsBySource.get(
        normalizedSourceProductCode
      )?.[0];

      if (defaultDestination) {
        const canonicalDestinationCode =
          productOptionValueByNormalizedCode.get(
            defaultDestination.destinationCode
          ) ?? defaultDestination.destinationCode;

        setTransferToProduct((previousProductCode) => {
          const normalizedPrevious = normalizeProductCode(previousProductCode);
          return normalizedPrevious === defaultDestination.destinationCode
            ? previousProductCode
            : canonicalDestinationCode;
        });
      } else {
        setTransferQty(0);
      }

      return;
    }

    const currentTransferQuantity = getCurrentTransferQuantity(
      normalizedSourceProductCode,
      normalizedDestinationProductCode
    );

    setTransferQty((previousQty) => {
      const previousValue = Number(previousQty || 0);
      return previousValue === currentTransferQuantity
        ? previousQty
        : currentTransferQuantity;
    });
  }, [
    getCurrentTransferQuantity,
    normalizeProductCode,
    productOptionValueByNormalizedCode,
    selectedProduct,
    setTransferQty,
    setTransferToProduct,
    transferOutByProduct.destinationsBySource,
    transferToProduct,
  ]);

  return {
    handleAdjustmentProductChange,
    openAdjustmentModalFromFilter,
    openAdjustmentForProduct,
    handleTransferToChange,
  };
}

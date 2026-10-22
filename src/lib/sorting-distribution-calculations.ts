export interface DerivedDistributionRow {
  quantity: number;
  percentage: number;
  groupNumber: string;
  distribution: number;
  checked: boolean;
}

export function calculateDerivedDistributionRows<
  T extends DerivedDistributionRow,
>(rows: T[], estQtyReceived: number, selectedQuantity: number | null): T[] {
  const totalQuantity = rows.reduce(
    (sum, row) => sum + (row.quantity > 0 ? row.quantity : 0),
    0
  );
  let groupNumber = 1;

  return rows.map((row) => {
    if (row.quantity <= 0) {
      return { ...row, percentage: 0, groupNumber: '', distribution: 0 };
    }

    return {
      ...row,
      percentage: totalQuantity <= 0 ? 0 : (row.quantity / totalQuantity) * 100,
      groupNumber: `Number ${groupNumber++}`,
      distribution:
        estQtyReceived <= 0 || selectedQuantity === null
          ? 0
          : Math.round((row.quantity / estQtyReceived) * selectedQuantity),
    };
  });
}

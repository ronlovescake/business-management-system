type AllocationInput = {
  key: string;
  available: number;
};

type AllocationResult = {
  key: string;
  allocated: number;
};

export function allocateByAvailability(
  items: AllocationInput[],
  totalQuantity: number
): AllocationResult[] {
  const normalizedTotal = Math.max(Math.floor(totalQuantity), 0);
  const normalizedItems = items
    .map((item) => ({
      key: item.key,
      available: Number.isFinite(item.available)
        ? Math.max(item.available, 0)
        : 0,
    }))
    .filter((item) => item.key.trim().length > 0);

  if (normalizedItems.length === 0 || normalizedTotal <= 0) {
    return normalizedItems.map((item) => ({ key: item.key, allocated: 0 }));
  }

  const totalAvailable = normalizedItems.reduce(
    (sum, item) => sum + item.available,
    0
  );

  if (totalAvailable <= 0) {
    return normalizedItems.map((item) => ({ key: item.key, allocated: 0 }));
  }

  const base = normalizedItems.map((item, index) => {
    const ideal = (item.available / totalAvailable) * normalizedTotal;
    const floor = Math.floor(ideal);
    return {
      key: item.key,
      index,
      floor,
      fractional: ideal - floor,
    };
  });

  const assigned = base.reduce((sum, item) => sum + item.floor, 0);
  const remainder = Math.max(normalizedTotal - assigned, 0);

  const byPriority = [...base].sort((a, b) => {
    if (b.fractional !== a.fractional) {
      return b.fractional - a.fractional;
    }

    return a.key.localeCompare(b.key);
  });

  for (let index = 0; index < remainder; index += 1) {
    const target = byPriority[index % byPriority.length];
    target.floor += 1;
  }

  const allocatedByIndex = new Map<number, number>();
  byPriority.forEach((item) => {
    allocatedByIndex.set(item.index, item.floor);
  });

  return normalizedItems.map((item, index) => ({
    key: item.key,
    allocated: allocatedByIndex.get(index) ?? 0,
  }));
}

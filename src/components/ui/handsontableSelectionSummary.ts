import type { SelectionSummary } from './HandsontableGrid';

interface SelectionBounds {
  row: number;
  col: number;
  row2?: number;
  col2?: number;
}

interface SelectionSummaryResult {
  valid: boolean;
  summary: SelectionSummary;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

const EMPTY_SELECTION_SUMMARY: SelectionSummary = {
  numericCount: 0,
  numericSum: 0,
  textCount: 0,
  cellCount: 0,
};

export function buildSelectionSummaryBounds({
  row,
  col,
  row2,
  col2,
}: SelectionBounds): SelectionSummaryResult {
  if (
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    row < 0 ||
    col < 0
  ) {
    return {
      valid: false,
      summary: EMPTY_SELECTION_SUMMARY,
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 0,
    };
  }

  return {
    valid: true,
    summary: EMPTY_SELECTION_SUMMARY,
    startRow: Math.min(row, row2 ?? row),
    endRow: Math.max(row, row2 ?? row),
    startCol: Math.min(col, col2 ?? col),
    endCol: Math.max(col, col2 ?? col),
  };
}

export function calculateSelectionSummary(params: {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  getDataAtCell: (row: number, col: number) => unknown;
}): SelectionSummary {
  const { startRow, endRow, startCol, endCol, getDataAtCell } = params;

  let numericCount = 0;
  let numericSum = 0;
  let textCount = 0;
  let cellCount = 0;

  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const cellValue = getDataAtCell(row, col);

      if (cellValue === null || cellValue === undefined) {
        continue;
      }

      if (typeof cellValue === 'number') {
        if (!Number.isNaN(cellValue)) {
          cellCount += 1;
          numericCount += 1;
          numericSum += cellValue;
        }
        continue;
      }

      if (typeof cellValue === 'string') {
        const trimmed = cellValue.trim();
        if (!trimmed) {
          continue;
        }

        const normalized = Number(trimmed.replace(/,/g, ''));
        cellCount += 1;

        if (!Number.isNaN(normalized)) {
          numericCount += 1;
          numericSum += normalized;
        } else {
          textCount += 1;
        }
        continue;
      }

      if (typeof cellValue === 'boolean') {
        cellCount += 1;
        textCount += 1;
        continue;
      }

      const fallbackValue = String(cellValue).trim();
      if (fallbackValue) {
        cellCount += 1;
        textCount += 1;
      }
    }
  }

  return {
    numericCount,
    numericSum,
    textCount,
    cellCount,
  };
}

export function hasSelectionSummaryChanged(
  previous: SelectionSummary | null,
  next: SelectionSummary
): boolean {
  if (!previous) {
    return true;
  }

  return (
    previous.numericCount !== next.numericCount ||
    previous.numericSum !== next.numericSum ||
    previous.textCount !== next.textCount ||
    previous.cellCount !== next.cellCount
  );
}

interface NavigationGrid {
  countRows(): number;
  countCols(): number;
  getDataAtCell(row: number, column: number): unknown;
}

export function getDataBoundary(
  grid: NavigationGrid,
  row: number,
  column: number,
  key: string
): [number, number] {
  const vertical = key === 'ArrowUp' || key === 'ArrowDown';
  const step = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
  const start = vertical ? row : column;
  const limit = (vertical ? grid.countRows() : grid.countCols()) - 1;
  const edge = step < 0 ? 0 : limit;
  const empty = (position: number) => {
    const value = grid.getDataAtCell(
      vertical ? position : row,
      vertical ? column : position
    );
    return value === null || value === undefined || value === '';
  };
  let target = start;
  if (!empty(start)) {
    for (
      let position = start + step;
      position >= 0 && position <= limit && !empty(position);
      position += step
    ) {
      target = position;
    }
  }
  if (target === start) {
    target = edge;
    for (
      let position = start + step;
      position >= 0 && position <= limit;
      position += step
    ) {
      if (!empty(position)) {
        target = position;
        break;
      }
    }
  }
  return vertical ? [target, column] : [row, target];
}

import { describe, expect, it } from 'vitest';
import { getDataBoundary } from '../dataBoundaryNavigation';

describe('data boundary navigation', () => {
  const values = ['', 'A', 0, false, '', null, 'B', undefined];
  it.each(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'])(
    'preserves runs, gaps, empty cells and edge fallback for %s',
    (key) => {
      const vertical = key === 'ArrowUp' || key === 'ArrowDown';
      const reverse = key === 'ArrowUp' || key === 'ArrowLeft';
      const grid = {
        countRows: () => (vertical ? values.length : 1),
        countCols: () => (vertical ? 1 : values.length),
        getDataAtCell: (row: number, column: number) => {
          const position = vertical ? row : column;
          return values[reverse ? values.length - 1 - position : position];
        },
      };
      const coordinate = (position: number): [number, number] => {
        const index = reverse ? values.length - 1 - position : position;
        return vertical ? [index, 0] : [0, index];
      };
      for (const [start, target] of [
        [0, 1],
        [1, 3],
        [3, 6],
        [4, 6],
        [6, 7],
        [7, 7],
      ]) {
        expect(getDataBoundary(grid, ...coordinate(start), key)).toEqual(
          coordinate(target)
        );
      }
    }
  );
});

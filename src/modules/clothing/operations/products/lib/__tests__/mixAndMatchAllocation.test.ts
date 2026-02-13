import { describe, expect, it } from 'vitest';
import { allocateByAvailability } from '../mixAndMatchAllocation';

describe('allocateByAvailability', () => {
  it('allocates by movement-adjusted availability and sums exactly to order qty', () => {
    const allocations = allocateByAvailability(
      [
        { key: 'Sleeveless Onesie (SO-020726)', available: 237 },
        { key: 'Ruffled Onesie (RO-020726)', available: 262 },
      ],
      100
    );

    expect(allocations).toEqual([
      { key: 'Sleeveless Onesie (SO-020726)', allocated: 47 },
      { key: 'Ruffled Onesie (RO-020726)', allocated: 53 },
    ]);
    expect(allocations.reduce((sum, item) => sum + item.allocated, 0)).toBe(
      100
    );
  });

  it('returns zero allocations when total available is zero', () => {
    const allocations = allocateByAvailability(
      [
        { key: 'A', available: 0 },
        { key: 'B', available: 0 },
      ],
      50
    );

    expect(allocations).toEqual([
      { key: 'A', allocated: 0 },
      { key: 'B', allocated: 0 },
    ]);
  });

  it('handles zero or negative requested quantity', () => {
    const allocations = allocateByAvailability(
      [
        { key: 'A', available: 10 },
        { key: 'B', available: 20 },
      ],
      -5
    );

    expect(allocations).toEqual([
      { key: 'A', allocated: 0 },
      { key: 'B', allocated: 0 },
    ]);
  });
});

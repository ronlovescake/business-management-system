import { describe, expect, it } from 'vitest';
import { calculateProductGridHeight } from '../productGridSizing';

describe('calculateProductGridHeight', () => {
  it('reserves the footer, stack gap and bottom inset within the viewport', () => {
    expect(
      calculateProductGridHeight({
        viewportHeight: 768,
        gridTop: 320,
        footerHeight: 40,
        stackGap: 16,
        bottomInset: 16,
      })
    ).toBe(376);
  });

  it('keeps a usable minimum height on short viewports', () => {
    expect(
      calculateProductGridHeight({
        viewportHeight: 400,
        gridTop: 280,
        footerHeight: 40,
        stackGap: 16,
        bottomInset: 16,
      })
    ).toBe(140);
  });

  it('does not exceed the viewport when the table top is scrolled out of view', () => {
    expect(
      calculateProductGridHeight({
        viewportHeight: 768,
        gridTop: -40,
        footerHeight: 40,
        stackGap: 16,
        bottomInset: 16,
      })
    ).toBe(696);
  });
});

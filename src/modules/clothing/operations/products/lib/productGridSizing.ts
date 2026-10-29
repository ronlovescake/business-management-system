export interface ProductGridHeightInput {
  viewportHeight: number;
  gridTop: number;
  footerHeight: number;
  stackGap: number;
  bottomInset: number;
}

export function calculateProductGridHeight({
  viewportHeight,
  gridTop,
  footerHeight,
  stackGap,
  bottomInset,
}: ProductGridHeightInput): number {
  return Math.max(
    140,
    Math.floor(
      viewportHeight -
        Math.max(gridTop, 0) -
        footerHeight -
        stackGap -
        bottomInset
    )
  );
}

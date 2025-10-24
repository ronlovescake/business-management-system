/**
 * Handsontable Type Definitions
 *
 * Custom type definitions for Handsontable grid components.
 * These replace the previous Glide Data Grid types after migration.
 */

/**
 * Column configuration for Handsontable grid
 */
export interface HandsontableColumn {
  /** Column header title */
  title: string;
  /** Column width in pixels */
  width: number;
  /** Column identifier */
  id: string;
  /** Whether the column should grow to fill available space */
  grow?: number;
}

/**
 * Cell position in the grid
 * Tuple of [columnIndex, rowIndex]
 */
export type CellPosition = readonly [number, number];

/**
 * Cell kinds for different data types
 */
export enum CellKind {
  Text = 'text',
  Number = 'number',
  Dropdown = 'dropdown',
  Date = 'date',
  Custom = 'custom',
}

/**
 * Base cell interface
 */
export interface BaseCell {
  /** The type of cell */
  kind: CellKind;
  /** The raw data value */
  data:
    | string
    | number
    | { kind: string; value: string; allowedValues?: string[] };
  /** The formatted display value */
  displayData: string;
  /** Whether the cell can be edited via overlay */
  allowOverlay: boolean;
  /** Whether the cell is read-only */
  readonly?: boolean;
  /** Data for copying to clipboard */
  copyData?: string;
}

/**
 * Text cell
 */
export interface TextCell extends BaseCell {
  kind: CellKind.Text;
  data: string;
}

/**
 * Number cell
 */
export interface NumberCell extends BaseCell {
  kind: CellKind.Number;
  data: number;
}

/**
 * Dropdown cell
 */
export interface DropdownCell extends BaseCell {
  kind: CellKind.Custom;
  data: {
    kind: 'dropdown-cell';
    value: string;
    allowedValues: string[];
  };
}

/**
 * Union type for all cell types
 */
export type HandsontableCell = TextCell | NumberCell | DropdownCell | BaseCell;

/**
 * Generic item type for grid rows
 * Extended by specific data types (e.g., TransactionData)
 */
export type HandsontableItem = Record<string, unknown>;

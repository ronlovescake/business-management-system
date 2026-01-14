import type { CSSProperties } from 'react';

export const ACCOUNTING_TABLE_HEADER_BG = '#f1f3f5';
export const ACCOUNTING_TABLE_TEXT_COLOR = '#495057';

export const ACCOUNTING_TABLE_HEAD_STYLE: CSSProperties = {
  backgroundColor: ACCOUNTING_TABLE_HEADER_BG,
};

export const ACCOUNTING_TABLE_HEAD_STICKY_STYLE: CSSProperties = {
  ...ACCOUNTING_TABLE_HEAD_STYLE,
  position: 'sticky',
  top: 0,
  zIndex: 2,
};

export const ACCOUNTING_TABLE_TH_BASE_STYLE: CSSProperties = {
  padding: '16px 12px',
  color: ACCOUNTING_TABLE_TEXT_COLOR,
  backgroundColor: ACCOUNTING_TABLE_HEADER_BG,
  textAlign: 'center',
};

export function accountingThStyle(
  overrides: CSSProperties = {}
): CSSProperties {
  return { ...ACCOUNTING_TABLE_TH_BASE_STYLE, ...overrides };
}

export const ACCOUNTING_TABLE_TD_CENTER_STYLE: CSSProperties = {
  color: ACCOUNTING_TABLE_TEXT_COLOR,
  textAlign: 'center',
};

export const ACCOUNTING_TABLE_TD_TEXT_STYLE: CSSProperties = {
  color: ACCOUNTING_TABLE_TEXT_COLOR,
};

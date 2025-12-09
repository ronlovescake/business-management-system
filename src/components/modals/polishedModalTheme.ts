import type { ModalProps } from '@mantine/core';

/**
 * Shared design tokens for the polished modal experience used across the app.
 * Centralising these values guarantees identical spacing, colour, typography
 * and border radii for every modal that opts into the polished look.
 */
export const polishedModalOverlayProps: NonNullable<
  ModalProps['overlayProps']
> = {
  color: '#0b1120',
  opacity: 1,
  blur: 0,
};

export const polishedModalStyles: NonNullable<ModalProps['styles']> = {
  content: {
    borderRadius: '12px',
    border: '1px solid #ebedf2',
    boxShadow: '0 32px 60px rgba(15, 23, 42, 0.18)',
  },
  header: {
    padding: '1.5rem 1.75rem 0.75rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#101828',
  },
  body: {
    padding: '0 1.75rem 1.85rem',
    overflowY: 'visible',
  },
};

export const polishedLabelStyles = {
  fontWeight: 600,
  fontSize: '1rem',
  color: '#475467',
  marginBottom: 6,
};

export const polishedInputBaseStyles = {
  backgroundColor: '#f5f5f5',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#e5e7ed',
  borderRadius: 4,
  padding: '0.65rem 0.95rem',
  fontSize: '1.05rem',
  color: '#1f2937',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
  minHeight: 48,
  '&::placeholder': {
    color: 'transparent',
  },
};

export const polishedFocusRingStyles = {
  borderColor: '#65ab58',
  boxShadow: '0 0 0 3px rgba(101, 171, 88, 0.25)',
};

export const polishedSelectDropdownStyles = {
  borderRadius: 16,
  border: '1px solid #e5e7ed',
  boxShadow: '0 18px 40px rgba(16, 24, 40, 0.08)',
};

export const polishedSelectOptionStyles = {
  borderRadius: 10,
  fontSize: '0.95rem',
  padding: '0.5rem 0.75rem',
};

export const polishedReadOnlyFieldStyles = {
  label: polishedLabelStyles,
  input: {
    ...polishedInputBaseStyles,
  },
};

export const polishedPrimaryButtonStyles = {
  root: {
    backgroundColor: '#29A829',
    color: '#ffffff',
    borderColor: '#29A829',
    '&:hover': {
      backgroundColor: '#228b22',
    },
    '&:disabled': {
      backgroundColor: '#94d494',
      borderColor: '#94d494',
      color: '#ffffff',
    },
  },
};

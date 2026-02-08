import React from 'react';
import { MantineProvider, Modal, type ModalProps } from '@mantine/core';

/**
 * Shared design tokens for the universal modal experience used across the app.
 * Centralising these values guarantees identical spacing, colour, typography
 * and border radii for every modal.
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
    borderRadius: '6px',
    border: '1px solid #ebedf2',
    boxShadow: '0 32px 60px rgba(15, 23, 42, 0.18)',
  },
  header: {
    padding: '1.5rem 1.75rem 0.75rem',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#545454',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    textAlign: 'center',
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
  borderRadius: 3,
  fontSize: '1.05rem',
  color: '#1f2937',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
  minHeight: 48,
};

const POLISHED_INPUT_PADDING_Y = '0.65rem';
const POLISHED_INPUT_PADDING_X = '0.95rem';

/**
 * Mantine inputs compute padding based on CSS variables and left/right sections.
 * We use wrapper-level variables (instead of overriding `padding` on the input)
 * so icons/sections never overlap placeholder/value text.
 */
export const polishedInputWrapperStyles: Record<string, unknown> = {
  '--input-padding-y': POLISHED_INPUT_PADDING_Y,
  '--input-padding-inline-start': `calc(${POLISHED_INPUT_PADDING_X} + var(--input-left-section-size, 0px))`,
  '--input-padding-inline-end': `calc(${POLISHED_INPUT_PADDING_X} + var(--input-right-section-size, 0px))`,
  '--input-placeholder-color': 'transparent',
};

export const polishedFocusRingStyles = {
  borderColor: '#65ab58',
  boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.25)',
};

export const polishedSelectDropdownStyles = {
  borderRadius: 12,
  border: '1px solid #65ab58',
  boxShadow: '0 18px 40px hsla(0, 0%, 100%, 0.08)',
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

const UNIVERSAL_PRIMARY_BUTTON_COLOR = '#228be6';
const UNIVERSAL_PRIMARY_BUTTON_HOVER_COLOR = '#1c7ed6';
const UNIVERSAL_PRIMARY_BUTTON_DISABLED_COLOR = '#74c0fc';

// Match SweetAlert2 default confirm button sizing:
// padding: 0.625em 1.1em; font-size: 1em; font-weight: 500
// With line-height: 1, total height becomes 2.25em.
const UNIVERSAL_BUTTON_FONT_SIZE = '1em';
const UNIVERSAL_BUTTON_HEIGHT = '2.25em';
const UNIVERSAL_BUTTON_PADDING_X = '1.1em';

type UniversalModalProps = Omit<ModalProps, 'children'> & {
  children: React.ReactNode;
};

const universalModalTheme = {
  components: {
    Button: {
      vars: (
        _theme: unknown,
        props: { variant?: string; disabled?: boolean }
      ) => {
        const rootVars: Record<string, unknown> = {
          '--button-fz': UNIVERSAL_BUTTON_FONT_SIZE,
          '--button-height': UNIVERSAL_BUTTON_HEIGHT,
          '--button-padding-x': UNIVERSAL_BUTTON_PADDING_X,
        };

        if (props.variant && props.variant !== 'filled') {
          return { root: rootVars };
        }

        return {
          root: {
            ...rootVars,
            '--button-bg': props.disabled
              ? UNIVERSAL_PRIMARY_BUTTON_DISABLED_COLOR
              : UNIVERSAL_PRIMARY_BUTTON_COLOR,
            '--button-hover': UNIVERSAL_PRIMARY_BUTTON_HOVER_COLOR,
            '--button-bd': props.disabled
              ? UNIVERSAL_PRIMARY_BUTTON_DISABLED_COLOR
              : UNIVERSAL_PRIMARY_BUTTON_COLOR,
            '--button-color': '#ffffff',
          },
        };
      },
      styles: {
        root: {
          borderRadius: 'calc(var(--mantine-radius-sm) - 2px)',
          fontFamily: 'inherit',
          fontWeight: 500,
        },
      },
    },
    TextInput: {
      styles: {
        wrapper: polishedInputWrapperStyles,
        label: polishedLabelStyles,
        input: {
          ...polishedInputBaseStyles,
          '&:focus': {
            ...polishedFocusRingStyles,
          },
        },
      },
    },
    NumberInput: {
      styles: {
        wrapper: polishedInputWrapperStyles,
        label: polishedLabelStyles,
        input: {
          ...polishedInputBaseStyles,
          '&:focus': {
            ...polishedFocusRingStyles,
          },
        },
      },
    },
    Textarea: {
      styles: {
        wrapper: polishedInputWrapperStyles,
        label: polishedLabelStyles,
        input: {
          ...polishedInputBaseStyles,
          minHeight: 108,
          resize: 'vertical' as const,
          '&:focus': {
            ...polishedFocusRingStyles,
          },
        },
      },
    },
    Select: {
      defaultProps: {
        withCheckIcon: false,
        maxDropdownHeight: 400,
        comboboxProps: { withinPortal: true, zIndex: 500 },
      },
      styles: {
        wrapper: polishedInputWrapperStyles,
        label: polishedLabelStyles,
        input: {
          ...polishedInputBaseStyles,
          '&:focus': {
            ...polishedFocusRingStyles,
          },
        },
        dropdown: polishedSelectDropdownStyles,
        option: polishedSelectOptionStyles,
        rightSection: {
          display: 'none',
          width: 0,
          margin: 0,
        },
      },
    },
    DateInput: {
      styles: {
        wrapper: polishedInputWrapperStyles,
        label: polishedLabelStyles,
        input: {
          ...polishedInputBaseStyles,
          '&:focus': {
            ...polishedFocusRingStyles,
          },
        },
      },
    },
  },
} as const;

function mergeModalStyles(
  overrides?: ModalProps['styles']
): NonNullable<ModalProps['styles']> {
  if (!overrides) {
    return polishedModalStyles;
  }

  const merged: Record<string, unknown> = {
    ...polishedModalStyles,
    ...overrides,
  };

  const contentOverride = (overrides as Record<string, unknown>).content;
  merged.content = {
    ...(polishedModalStyles.content ?? {}),
    ...(typeof contentOverride === 'object' && contentOverride
      ? (contentOverride as Record<string, unknown>)
      : {}),
    borderRadius: polishedModalStyles.content?.borderRadius,
  };

  (['header', 'title', 'body', 'close'] as const).forEach((key) => {
    const basePart = (polishedModalStyles as Record<string, unknown>)[key];
    const overridePart = (overrides as Record<string, unknown>)[key];

    merged[key] = {
      ...(typeof basePart === 'object' && basePart
        ? (basePart as Record<string, unknown>)
        : {}),
      ...(typeof overridePart === 'object' && overridePart
        ? (overridePart as Record<string, unknown>)
        : {}),
    };
  });

  merged.title = {
    ...(merged.title as Record<string, unknown>),
    color: polishedModalStyles.title?.color,
  };

  return merged as NonNullable<ModalProps['styles']>;
}

/**
 * Universal modal wrapper.
 *
 * Visual baseline:
 * - Header matches the "Record Payments" modal (title-only, centered)
 * - Field styling matches "Add New Household Expense" via shared polished tokens
 */
export function UniversalModal({
  children,
  radius = 'md',
  padding = 'xl',
  centered = true,
  closeOnClickOutside = false,
  closeOnEscape = false,
  overlayProps,
  styles,
  title,
  ...rest
}: UniversalModalProps) {
  const mergedOverlay = {
    ...polishedModalOverlayProps,
    ...overlayProps,
  };

  const mergedStyles = mergeModalStyles(styles);

  const normalizedTitle =
    typeof title === 'string' ? title.toUpperCase() : title;

  return (
    <MantineProvider theme={universalModalTheme}>
      <Modal
        radius={radius}
        padding={padding}
        centered={centered}
        closeOnClickOutside={closeOnClickOutside}
        closeOnEscape={closeOnEscape}
        overlayProps={mergedOverlay}
        styles={mergedStyles}
        title={normalizedTitle}
        {...rest}
      >
        {children}
      </Modal>
    </MantineProvider>
  );
}

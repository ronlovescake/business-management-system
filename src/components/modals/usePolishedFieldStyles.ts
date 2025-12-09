import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  polishedFocusRingStyles,
  polishedInputBaseStyles,
  polishedLabelStyles,
  polishedSelectDropdownStyles,
  polishedSelectOptionStyles,
} from './polishedModalTheme';

interface FieldHandlers {
  onFocus: () => void;
  onBlur: () => void;
}

interface SelectHandlers extends FieldHandlers {
  onDropdownOpen: () => void;
  onDropdownClose: () => void;
}

interface FieldProps {
  styles: {
    label: typeof polishedLabelStyles;
    input: Record<string, unknown>;
  };
  handlers: FieldHandlers;
}

interface SelectProps {
  styles: {
    label: typeof polishedLabelStyles;
    input: Record<string, unknown>;
    dropdown: Record<string, unknown>;
    option: Record<string, unknown>;
  };
  handlers: SelectHandlers;
}

const buildInputStyles = (isFocused: boolean) => ({
  label: polishedLabelStyles,
  input: isFocused
    ? { ...polishedInputBaseStyles, ...polishedFocusRingStyles }
    : { ...polishedInputBaseStyles },
});

const buildTextareaStyles = (isFocused: boolean) => ({
  label: polishedLabelStyles,
  input: {
    ...polishedInputBaseStyles,
    minHeight: 108,
    resize: 'vertical' as const,
    ...(isFocused ? polishedFocusRingStyles : {}),
  },
});

const buildSelectStyles = (isFocused: boolean) => ({
  label: polishedLabelStyles,
  input: isFocused
    ? { ...polishedInputBaseStyles, ...polishedFocusRingStyles }
    : { ...polishedInputBaseStyles },
  dropdown: polishedSelectDropdownStyles,
  option: polishedSelectOptionStyles,
  rightSection: {
    display: 'none',
    width: 0,
    margin: 0,
  },
});

/**
 * Hook that encapsulates the focus styling logic used by the polished modal
 * forms. Components receive helpers that already wire focus/blur handlers and
 * return the correct Mantine styles so every field highlights consistently.
 */
export function usePolishedFieldStyles(isModalOpen: boolean) {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isModalOpen) {
      setFocusedField(null);
    }
  }, [isModalOpen]);

  const setFocus = useCallback((fieldKey: string) => {
    setFocusedField(fieldKey);
  }, []);

  const clearFocus = useCallback((fieldKey: string) => {
    setFocusedField((current) => (current === fieldKey ? null : current));
  }, []);

  const getHandlers = useCallback(
    (fieldKey: string): FieldHandlers => ({
      onFocus: () => setFocus(fieldKey),
      onBlur: () => clearFocus(fieldKey),
    }),
    [clearFocus, setFocus]
  );

  const getSelectHandlers = useCallback(
    (fieldKey: string): SelectHandlers => ({
      ...getHandlers(fieldKey),
      onDropdownOpen: () => setFocus(fieldKey),
      onDropdownClose: () => clearFocus(fieldKey),
    }),
    [clearFocus, getHandlers, setFocus]
  );

  const getFieldProps = useCallback(
    (fieldKey: string): FieldProps => ({
      styles: buildInputStyles(focusedField === fieldKey),
      handlers: getHandlers(fieldKey),
    }),
    [focusedField, getHandlers]
  );

  const getTextareaProps = useCallback(
    (fieldKey: string): FieldProps => ({
      styles: buildTextareaStyles(focusedField === fieldKey),
      handlers: getHandlers(fieldKey),
    }),
    [focusedField, getHandlers]
  );

  const getSelectProps = useCallback(
    (fieldKey: string): SelectProps => ({
      styles: buildSelectStyles(focusedField === fieldKey),
      handlers: getSelectHandlers(fieldKey),
    }),
    [focusedField, getSelectHandlers]
  );

  return useMemo(
    () => ({
      focusedField,
      setFocusedField,
      getFieldProps,
      getTextareaProps,
      getSelectProps,
    }),
    [focusedField, getFieldProps, getSelectProps, getTextareaProps]
  );
}

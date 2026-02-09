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
  padding: '0.65rem 0.95rem',
  fontSize: '1.05rem',
  color: '#1f2937',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
  minHeight: 48,
  '&::placeholder': {
    color: 'transparent',
  },
};

export const polishedReadOnlyFieldStyles = {
  label: polishedLabelStyles,
  input: {
    ...polishedInputBaseStyles,
  },
};

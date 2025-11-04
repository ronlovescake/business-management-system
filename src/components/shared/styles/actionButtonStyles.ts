export const actionButtonStyles = {
  root: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontWeight: 600,
    '&:hover': {
      backgroundColor: '#1d4ed8',
    },
    '&:focus': {
      backgroundColor: '#1d4ed8',
    },
    '&:disabled': {
      backgroundColor: '#bfdbfe',
      color: '#1e3a8a',
    },
  },
} as const;

export const actionOutlineButtonStyles = {
  root: {
    borderColor: '#2563eb',
    color: '#2563eb',
    fontWeight: 600,
    backgroundColor: '#ffffff',
    '&:hover': {
      backgroundColor: '#dbeafe',
    },
    '&:focus': {
      backgroundColor: '#dbeafe',
    },
  },
} as const;

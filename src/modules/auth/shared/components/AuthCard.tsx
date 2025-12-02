import type { ReactNode } from 'react';
import { Box } from '@mantine/core';

interface AuthCardProps {
  children: ReactNode;
  maxWidth?: number;
}

export function AuthCard({ children, maxWidth = 440 }: AuthCardProps) {
  return (
    <Box
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: `${maxWidth}px`,
        background: 'rgba(255, 255, 255, 0.15)',
        borderRadius: '24px',
        padding: '3rem 2.5rem',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: `
          0 8px 32px 0 rgba(0, 0, 0, 0.1),
          inset 0 1px 1px 0 rgba(255, 255, 255, 0.4),
          inset 0 -1px 1px 0 rgba(255, 255, 255, 0.1)
        `,
      }}
    >
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)',
          borderRadius: '24px',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </Box>
  );
}

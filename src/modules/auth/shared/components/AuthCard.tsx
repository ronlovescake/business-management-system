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
        background: 'rgba(255, 255, 255, 0.72)',
        borderRadius: '32px',
        padding: 'clamp(1.75rem, 2vw + 1rem, 2.75rem)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.72)',
        boxShadow: `
          0 20px 55px rgba(15, 23, 42, 0.14),
          0 8px 28px rgba(99, 102, 241, 0.12),
          inset 0 1px 0 rgba(255, 255, 255, 0.7)
        `,
        overflow: 'hidden',
      }}
    >
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(145deg, rgba(255, 255, 255, 0.88) 0%, rgba(248, 250, 252, 0.18) 100%)',
          borderRadius: '32px',
          pointerEvents: 'none',
        }}
      />
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          inset: 'auto -20% -38% auto',
          width: '18rem',
          height: '18rem',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0) 72%)',
          filter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </Box>
  );
}

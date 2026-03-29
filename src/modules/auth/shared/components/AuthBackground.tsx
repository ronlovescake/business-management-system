import type { ReactNode } from 'react';
import { Box } from '@mantine/core';

interface AuthBackgroundProps {
  children: ReactNode;
}

export function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <Box
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'url(/backgrounds/orange-waves.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh',
        overflow: 'auto',
        padding: '2rem 1rem',
      }}
    >
      {children}
    </Box>
  );
}

import type { ReactNode } from 'react';
import { Box } from '@mantine/core';

interface AuthBackgroundProps {
  children: ReactNode;
}

export function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <Box
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        overflow: 'hidden',
        padding: 'clamp(1rem, 3vw, 2rem)',
        background:
          'linear-gradient(180deg, #f8fbff 0%, #eef4ff 42%, #f7f3ff 100%)',
      }}
    >
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(148, 163, 184, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.09) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage:
            'radial-gradient(circle at center, black 22%, transparent 85%)',
        }}
      />
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          top: '-12%',
          left: '-8%',
          width: '34rem',
          height: '34rem',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(59, 130, 246, 0.24) 0%, rgba(59, 130, 246, 0) 72%)',
          filter: 'blur(24px)',
        }}
      />
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          right: '-10%',
          top: '8%',
          width: '26rem',
          height: '26rem',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(248, 113, 113, 0.18) 0%, rgba(248, 113, 113, 0) 74%)',
          filter: 'blur(18px)',
        }}
      />
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-16%',
          left: '24%',
          width: '30rem',
          height: '30rem',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(56, 189, 248, 0.24) 0%, rgba(56, 189, 248, 0) 72%)',
          filter: 'blur(22px)',
        }}
      />
      <Box
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '1120px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

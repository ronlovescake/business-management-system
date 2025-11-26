'use client';

import { useEffect } from 'react';

interface ClothingEmployeesThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Adds a themed class to the body for the clothing employees workspace without
 * introducing any additional layout wrappers.
 */
export function ClothingEmployeesThemeProvider({
  children,
}: ClothingEmployeesThemeProviderProps) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const className = 'clothing-employees-theme';
    document.body.classList.add(className);
    return () => {
      document.body.classList.remove(className);
    };
  }, []);

  return <>{children}</>;
}

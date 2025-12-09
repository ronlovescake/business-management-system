import { createContext, useContext } from 'react';
import type { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';

type PolishedFormStylesValue = ReturnType<typeof usePolishedFieldStyles>;

const PolishedFormStylesContext = createContext<PolishedFormStylesValue | null>(
  null
);

export function PolishedFormStylesProvider({
  value,
  children,
}: {
  value: PolishedFormStylesValue;
  children: React.ReactNode;
}) {
  return (
    <PolishedFormStylesContext.Provider value={value}>
      {children}
    </PolishedFormStylesContext.Provider>
  );
}

export function usePolishedFormStyles() {
  const context = useContext(PolishedFormStylesContext);
  if (!context) {
    throw new Error(
      'usePolishedFormStyles must be used within PolishedFormStylesProvider'
    );
  }
  return context;
}

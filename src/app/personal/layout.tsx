import type { ReactNode } from 'react';
import { ClothingEmployeesThemeProvider } from '@/modules/clothing/employees/theme/ClothingEmployeesThemeProvider';

export default function PersonalLayout({ children }: { children: ReactNode }) {
  return (
    <ClothingEmployeesThemeProvider>{children}</ClothingEmployeesThemeProvider>
  );
}

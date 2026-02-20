import type { ReactNode } from 'react';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export async function renderGmOperationsPage(
  modulePath: string,
  children: ReactNode
) {
  return renderOperationsPage(modulePath, children);
}

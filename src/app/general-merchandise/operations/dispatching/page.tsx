import type { Metadata } from 'next';
import { DispatchingRoutePage } from '@/app/operations/dispatching/_shared/DispatchingRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export const metadata: Metadata = {
  title: 'Dispatching - General Merchandise',
  description: 'Manage dispatching operations and tracking',
};

export default async function GeneralMerchandiseDispatchingPage() {
  return renderOperationsPage(
    '/general-merchandise/operations/dispatching',
    <DispatchingRoutePage />
  );
}

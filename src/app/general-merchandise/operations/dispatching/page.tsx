import type { Metadata } from 'next';
import { DispatchingRoutePage } from '@/app/operations/dispatching/_shared/DispatchingRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export const metadata: Metadata = {
  title: 'Dispatching - General Merchandise',
  description: 'Manage dispatching operations and tracking',
};

export default async function GeneralMerchandiseDispatchingPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/dispatching',
    <DispatchingRoutePage />
  );
}

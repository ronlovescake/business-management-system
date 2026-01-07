/**
 * Payment Cards Service
 * Thin API client for payment card CRUD operations.
 */

import { api } from '@/lib/api/client';
import { ensureArray } from '@/lib/api/normalize';

export interface PaymentCard {
  id: string;
  bank: string;
  label: string;
  nameOnCard: string;
  last4: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCardInput {
  bank: string;
  label: string;
  nameOnCard: string;
  last4?: string;
}

const endpoint = '/api/settings/payment-cards';

export const paymentCardService = {
  async list(): Promise<PaymentCard[]> {
    const response = await api.get<PaymentCard[] | { data: PaymentCard[] }>(
      endpoint
    );
    return ensureArray<PaymentCard>(response);
  },

  async create(payload: PaymentCardInput): Promise<PaymentCard> {
    return api.post<PaymentCard>(endpoint, payload);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`${endpoint}/${id}`);
  },
};

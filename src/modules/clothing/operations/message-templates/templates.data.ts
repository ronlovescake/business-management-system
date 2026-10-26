import type { MessageTemplate } from './types';

export const MESSAGE_TEMPLATE_TITLE_ORDER: string[] = [
  '10% Reservation Deposit',
  'Reservation Deposit - PAID',
  'Payment Reminders',
  'Cancellation: Did Not Pay Reservation Deposit',
  'Cancellation: Without Reservation Deposit',
  'Cancellation: With Reservation Deposit',
];

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'reservation-fee-10-percent',
    title: '10% Reservation Deposit',
    badge: 'Reservation',
    paragraphs: [
      'Dear Customer,',
      'To reserve your order, the agreed 10% Reservation Deposit secures your items and allows us to prepare your order.',
      'Please send the Reservation Deposit by the due date shown on your invoice.',
      'Once paid, kindly send us the proof of payment so we can confirm your reservation.',
      'Thank you for your continued support.',
      'Warm regards,',
      'Czarlie & Ron',
    ],
  },
  {
    id: 'reservation-fee-paid',
    title: 'Reservation Deposit - PAID',
    badge: 'Reservation',
    paragraphs: [
      'Dear Customer,',
      'Thank you for paying the Reservation Deposit. Your order is now reserved and we will proceed with preparation.',
      'Please pay any remaining balance by the due date shown on your invoice. Fully paid orders awaiting checkout or pickup are not payment-overdue.',
      'If you have any questions, let us know and we’ll be happy to assist.',
      'Warm regards,',
      'Czarlie & Ron',
    ],
  },
  {
    id: 'payment-reminders',
    title: 'Payment Reminders',
    badge: 'Reminder',
    paragraphs: [
      'Dear Customer,',
      'This is a gentle reminder regarding your pending transaction with us. Our records indicate that payment has not yet been completed and we understand this may have simply slipped your mind.',
      'Please settle the outstanding balance by the due date shown on your invoice. Overdue orders are reviewed; cancellation is not automatic.',
      'If you have already settled this or believe you have received this message in error, please disregard this notice.',
      'Thank you for your prompt attention and continued support.',
      'Warm regards,',
      'Czarlie & Ron',
    ],
  },
  {
    id: 'cancellation-did-not-pay-reservation-fee',
    title: 'Cancellation: Did Not Pay Reservation Deposit',
    badge: 'Cancellation',
    paragraphs: [
      'Dear Customer,',
      'After review, your recent transaction has been cancelled because the agreed Reservation Deposit was not paid by the invoice due date.',
      'If you still wish to proceed, please contact us to confirm a new order and payment terms.',
      'Thank you for your understanding and continued support.',
      'Warm regards,',
      'Czarlie & Ron',
    ],
  },
  {
    id: 'cancellation-without-reservation-fee',
    title: 'Cancellation: Without Reservation Deposit',
    badge: 'Cancellation',
    paragraphs: [
      'Dear Customer,',
      'After review, your recent unpaid transaction has been cancelled.',
      'Please contact us to confirm a new order and its invoice payment terms.',
      'Thank you for your understanding and continued support.',
      'Warm regards,',
      'Czarlie & Ron',
    ],
  },
  {
    id: 'cancellation-with-reservation-fee',
    title: 'Cancellation: With Reservation Deposit',
    badge: 'Cancellation',
    paragraphs: [
      'Dear Customer,',
      'After review, your recent transaction has been cancelled.',
      'Any retained Reservation Deposit and approved refund follow the reviewed decision communicated to you. Additional installments are not automatically forfeited.',
      'Refund approval is separate from actual payment. Please contact us for your recorded refund and payout details.',
      'Thank you for your understanding and continued support.',
      'Warm regards,',
      'Czarlie & Ron',
    ],
  },
];

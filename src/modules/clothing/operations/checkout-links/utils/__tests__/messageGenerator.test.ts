/**
 * Tests for Message Generator Utility
 */

import { describe, it, expect } from 'vitest';
import {
  getTimeBasedGreeting,
  generateInvoiceMessage,
  validateTemplate,
  MESSAGE_PLACEHOLDERS,
} from '../messageGenerator';

describe('messageGenerator', () => {
  describe('getTimeBasedGreeting', () => {
    it('should return "Good Morning" for 4:00 AM - 7:59 AM', () => {
      const testCases = [
        new Date('2025-01-01T04:00:00'),
        new Date('2025-01-01T06:30:00'),
        new Date('2025-01-01T07:59:00'),
      ];

      testCases.forEach((date) => {
        expect(getTimeBasedGreeting(date)).toBe('Good Morning');
      });
    });

    it('should return "Good Day" for 8:00 AM - 4:59 PM', () => {
      const testCases = [
        new Date('2025-01-01T08:00:00'),
        new Date('2025-01-01T12:00:00'),
        new Date('2025-01-01T16:59:00'),
      ];

      testCases.forEach((date) => {
        expect(getTimeBasedGreeting(date)).toBe('Good Day');
      });
    });

    it('should return "Good Afternoon" for 5:00 PM - 5:59 PM', () => {
      const testCases = [
        new Date('2025-01-01T17:00:00'),
        new Date('2025-01-01T17:30:00'),
        new Date('2025-01-01T17:59:00'),
      ];

      testCases.forEach((date) => {
        expect(getTimeBasedGreeting(date)).toBe('Good Afternoon');
      });
    });

    it('should return "Good Evening" for 6:00 PM - 3:59 AM', () => {
      const testCases = [
        new Date('2025-01-01T18:00:00'),
        new Date('2025-01-01T22:00:00'),
        new Date('2025-01-01T00:00:00'),
        new Date('2025-01-01T03:59:00'),
      ];

      testCases.forEach((date) => {
        expect(getTimeBasedGreeting(date)).toBe('Good Evening');
      });
    });

    it('should use current time when no date provided', () => {
      const greeting = getTimeBasedGreeting();
      expect([
        'Good Morning',
        'Good Day',
        'Good Afternoon',
        'Good Evening',
      ]).toContain(greeting);
    });
  });

  describe('generateInvoiceMessage', () => {
    const mockData = {
      driveFilesUrl: 'drive.google.com/file/123',
      shopeeCheckoutLink: 'shopee.ph/checkout/abc',
      paymentChannelsUrl: 'drive.google.com/payment',
    };

    it('should replace GREETING placeholder with time-based greeting', () => {
      const template = '{GREETING}, welcome!';
      const date = new Date('2025-01-01T12:00:00'); // Good Day

      const result = generateInvoiceMessage(template, { ...mockData, date });

      expect(result).toBe('Good Day, welcome!');
    });

    it('should replace DRIVE_FILES placeholder', () => {
      const template = 'View invoice: {DRIVE_FILES}';

      const result = generateInvoiceMessage(template, mockData);

      expect(result).toBe('View invoice: drive.google.com/file/123');
    });

    it('should replace SHOPEE_LINK placeholder', () => {
      const template = 'Checkout: {SHOPEE_LINK}';

      const result = generateInvoiceMessage(template, mockData);

      expect(result).toBe('Checkout: shopee.ph/checkout/abc');
    });

    it('should replace PAYMENT_CHANNELS_URL placeholder', () => {
      const template = 'Payment: {PAYMENT_CHANNELS_URL}';

      const result = generateInvoiceMessage(template, mockData);

      expect(result).toBe('Payment: drive.google.com/payment');
    });

    it('should replace all placeholders in full template', () => {
      const template = `{GREETING}

Your order is ready!

Invoice: {DRIVE_FILES}
Payment: {PAYMENT_CHANNELS_URL}
Checkout: {SHOPEE_LINK}

Thank you!`;

      const date = new Date('2025-01-01T17:30:00'); // Good Afternoon
      const result = generateInvoiceMessage(template, { ...mockData, date });

      expect(result).toBe(`Good Afternoon

Your order is ready!

Invoice: drive.google.com/file/123
Payment: drive.google.com/payment
Checkout: shopee.ph/checkout/abc

Thank you!`);
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const template = '{GREETING}! {GREETING} again!';
      const date = new Date('2025-01-01T08:00:00'); // Good Day

      const result = generateInvoiceMessage(template, { ...mockData, date });

      expect(result).toBe('Good Day! Good Day again!');
    });

    it('should handle template with no placeholders', () => {
      const template = 'No placeholders here';

      const result = generateInvoiceMessage(template, mockData);

      expect(result).toBe('No placeholders here');
    });
  });

  describe('validateTemplate', () => {
    it('should validate template with all required placeholders', () => {
      const template = `{GREETING}

Invoice: {DRIVE_FILES}
Checkout: {SHOPEE_LINK}`;

      const result = validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.missingPlaceholders).toHaveLength(0);
    });

    it('should detect missing DRIVE_FILES placeholder', () => {
      const template = '{GREETING}, Checkout: {SHOPEE_LINK}';

      const result = validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.missingPlaceholders).toContain(
        MESSAGE_PLACEHOLDERS.DRIVE_FILES
      );
    });

    it('should detect missing SHOPEE_LINK placeholder', () => {
      const template = '{GREETING}, Invoice: {DRIVE_FILES}';

      const result = validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.missingPlaceholders).toContain(
        MESSAGE_PLACEHOLDERS.SHOPEE_LINK
      );
    });

    it('should detect multiple missing placeholders', () => {
      const template = '{GREETING}, thank you!';

      const result = validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.missingPlaceholders).toHaveLength(2);
      expect(result.missingPlaceholders).toContain(
        MESSAGE_PLACEHOLDERS.DRIVE_FILES
      );
      expect(result.missingPlaceholders).toContain(
        MESSAGE_PLACEHOLDERS.SHOPEE_LINK
      );
    });

    it('should not require GREETING placeholder', () => {
      const template = 'Invoice: {DRIVE_FILES}, Checkout: {SHOPEE_LINK}';

      const result = validateTemplate(template);

      expect(result.isValid).toBe(true);
    });

    it('should not require PAYMENT_CHANNELS_URL placeholder', () => {
      const template = '{DRIVE_FILES} and {SHOPEE_LINK}';

      const result = validateTemplate(template);

      expect(result.isValid).toBe(true);
    });
  });
});

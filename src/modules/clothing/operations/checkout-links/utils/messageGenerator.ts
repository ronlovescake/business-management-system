/**
 * Message Generator Utility
 * Generates customer invoice messages with time-based greetings and dynamic placeholders
 */

/**
 * Message placeholders that can be used in templates
 */
export const MESSAGE_PLACEHOLDERS = {
  GREETING: '{GREETING}',
  DRIVE_FILES: '{DRIVE_FILES}',
  SHOPEE_LINK: '{SHOPEE_LINK}',
  PAYMENT_CHANNELS_URL: '{PAYMENT_CHANNELS_URL}',
} as const;

/**
 * Determines time-based greeting based on current hour (PHT)
 * - 4:00 AM - 7:59 AM: "Good Morning"
 * - 8:00 AM - 4:59 PM: "Good Day"
 * - 5:00 PM - 5:59 PM: "Good Afternoon"
 * - 6:00 PM - 3:59 AM: "Good Evening"
 */
export function getTimeBasedGreeting(date: Date = new Date()): string {
  const hour = date.getHours();

  if (hour >= 4 && hour < 8) {
    return 'Good Morning';
  }

  if (hour >= 8 && hour < 17) {
    return 'Good Day';
  }

  if (hour >= 17 && hour < 18) {
    return 'Good Afternoon';
  }

  // 6:00 PM - 3:59 AM
  return 'Good Evening';
}

/**
 * Replace placeholders in message template with actual values
 */
interface MessageData {
  driveFilesUrl: string;
  shopeeCheckoutLink: string;
  paymentChannelsUrl: string;
  date?: Date; // Optional, defaults to current time
}

/**
 * Generate customer invoice message from template
 *
 * @param template - Message template with placeholders
 * @param data - Dynamic data to replace placeholders with
 * @returns Generated message with all placeholders replaced
 *
 * @example
 * ```ts
 * const message = generateInvoiceMessage(
 *   "Hi {GREETING}! Invoice: {DRIVE_FILES}",
 *   {
 *     driveFilesUrl: "drive.google.com/file/123",
 *     shopeeCheckoutLink: "shopee.ph/checkout/abc",
 *     paymentChannelsUrl: "drive.google.com/payment"
 *   }
 * );
 * // Result: "Hi Good Day! Invoice: drive.google.com/file/123"
 * ```
 */
export function generateInvoiceMessage(
  template: string,
  data: MessageData
): string {
  const greeting = getTimeBasedGreeting(data.date);

  let message = template;

  // Replace all placeholders
  message = message.replace(
    new RegExp(MESSAGE_PLACEHOLDERS.GREETING, 'g'),
    greeting
  );
  message = message.replace(
    new RegExp(MESSAGE_PLACEHOLDERS.DRIVE_FILES, 'g'),
    data.driveFilesUrl
  );
  message = message.replace(
    new RegExp(MESSAGE_PLACEHOLDERS.SHOPEE_LINK, 'g'),
    data.shopeeCheckoutLink
  );
  message = message.replace(
    new RegExp(MESSAGE_PLACEHOLDERS.PAYMENT_CHANNELS_URL, 'g'),
    data.paymentChannelsUrl
  );

  return message;
}

/**
 * Validate that a template contains required placeholders
 */
export function validateTemplate(template: string): {
  isValid: boolean;
  missingPlaceholders: string[];
} {
  const requiredPlaceholders = [
    MESSAGE_PLACEHOLDERS.DRIVE_FILES,
    MESSAGE_PLACEHOLDERS.SHOPEE_LINK,
  ];

  const missingPlaceholders = requiredPlaceholders.filter(
    (placeholder) => !template.includes(placeholder)
  );

  return {
    isValid: missingPlaceholders.length === 0,
    missingPlaceholders,
  };
}

/**
 * Invoice Settings Reset API Route
 * Resets invoice settings to default values
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const DEFAULT_MESSAGE_TEMPLATE = `{GREETING}

Your order has been packed and ready for dispatch!
Please complete this transaction within 3 days.

View invoice:
{DRIVE_FILES}

Payment Channels:
{PAYMENT_CHANNELS_URL}

Shopee checkout link:
{SHOPEE_LINK}

FOR SHOPEE CHECKOUTS:
1. Deduct ₱50.00 from your amount due
2. Change the courier to J&T

We look forward to completing your order!

Czarlie & Ron`;

const DEFAULT_PAYMENT_CHANNELS_URL =
  'drive.google.com/drive/folders/1PsgfqahjqjSlts3NZnhQ8XQKxDJKohqF';

/**
 * POST /api/invoice-settings/reset
 *
 * Reset invoice settings to default
 */
export async function POST() {
  try {
    // Get existing settings
    const existingSettings = await prisma.invoiceSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    let settings;

    if (existingSettings) {
      // Update existing settings to default
      settings = await prisma.invoiceSettings.update({
        where: { id: existingSettings.id },
        data: {
          messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
          paymentChannelsUrl: DEFAULT_PAYMENT_CHANNELS_URL,
        },
      });
    } else {
      // Create new default settings
      settings = await prisma.invoiceSettings.create({
        data: {
          messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
          paymentChannelsUrl: DEFAULT_PAYMENT_CHANNELS_URL,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Invoice settings reset to default',
    });
  } catch (error) {
    logger.error('Error resetting invoice settings', error);
    return NextResponse.json(
      { error: 'Failed to reset invoice settings' },
      { status: 500 }
    );
  }
}

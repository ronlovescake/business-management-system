/**
 * Invoice Settings API Route
 * Manages customer invoice message templates and configuration
 */

import type { NextRequest } from 'next/server';
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
 * GET /api/invoice-settings
 *
 * Fetch current invoice settings (creates default if none exists)
 */
export async function GET() {
  try {
    // Try to get existing settings
    let settings = await prisma.invoiceSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // If no settings exist, create default
    if (!settings) {
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
    });
  } catch (error) {
    logger.error('Error fetching invoice settings', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/invoice-settings
 *
 * Update invoice settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageTemplate, paymentChannelsUrl } = body;

    if (!messageTemplate || typeof messageTemplate !== 'string') {
      return NextResponse.json(
        { error: 'Message template is required' },
        { status: 400 }
      );
    }

    if (!paymentChannelsUrl || typeof paymentChannelsUrl !== 'string') {
      return NextResponse.json(
        { error: 'Payment channels URL is required' },
        { status: 400 }
      );
    }

    // Get existing settings or create new one
    const existingSettings = await prisma.invoiceSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    let updatedSettings;

    if (existingSettings) {
      // Update existing
      updatedSettings = await prisma.invoiceSettings.update({
        where: { id: existingSettings.id },
        data: {
          messageTemplate: messageTemplate.trim(),
          paymentChannelsUrl: paymentChannelsUrl.trim(),
        },
      });
    } else {
      // Create new
      updatedSettings = await prisma.invoiceSettings.create({
        data: {
          messageTemplate: messageTemplate.trim(),
          paymentChannelsUrl: paymentChannelsUrl.trim(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedSettings,
    });
  } catch (error) {
    logger.error('Error updating invoice settings', error);
    return NextResponse.json(
      { error: 'Failed to update invoice settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoice-settings/reset
 *
 * Reset invoice settings to default
 */
export async function POST() {
  try {
    // Delete all existing settings
    await prisma.invoiceSettings.deleteMany({});

    // Create new default settings
    const settings = await prisma.invoiceSettings.create({
      data: {
        messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
        paymentChannelsUrl: DEFAULT_PAYMENT_CHANNELS_URL,
      },
    });

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

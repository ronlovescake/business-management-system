// ==============================================================================
// ⚠️⚠️⚠️ CRITICAL WARNING - READ BEFORE MAKING ANY CHANGES ⚠️⚠️⚠️
// ==============================================================================
//
// This API generates invoice PDFs for transactions with "Warehouse" status.
// It also supports reservation-fee invoices for "In Transit" orders using
// dedicated templates that charge either 10% or 20% of the subtotal.
//
// ✅ BUSINESS LOGIC - DO NOT MODIFY:
//    - Filter: Only "Warehouse" Order Status transactions (standard invoices)
//    - Group by customer: One invoice per customer
//    - Invoice Date: Auto-populate if empty (format: "October 3, 2025")
//    - Due Date: Invoice Date + 3 days
//    - Include ALL warehouse transactions regardless of existing Invoice Date
//    - DO NOT overwrite existing Invoice Date timestamps
//    - DO NOT touch PACKED DATE or SHIPMENT CODE columns
//    - Reservation invoices: include only "In Transit" orders WHERE Adjustment = 0.00
//      (unpaid reservation fees), no status updates, and charge 10% or 20% of
//      the subtotal as the reservation fee
//
// 📋 CALCULATIONS:
//    - Sub Total: Sum of all Line Totals
//    - Credit Amount: Sum of all Adjustments
//    - Amount Due: Sub Total + Credit Amount
//
// 🚨 IF YOU NEED TO CHANGE THE BUSINESS LOGIC:
//    1. DO NOT proceed without business owner approval
//    2. Test thoroughly with real business scenarios
//    3. Update all warning comments
//
// ==============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import Handlebars from 'handlebars/dist/cjs/handlebars';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { LOADING_SPINNER_DELAY } from '@/constants/timeouts';

interface Transaction {
  id?: number;
  Customers?: string;
  'Product Code'?: string;
  Quantity?: number;
  'Unit Price'?: number;
  Adjustment?: number;
  'Line Total'?: number;
  'Order Status'?: string;
  'Invoice Date'?: string;
}

interface Customer {
  'Customer Name'?: string;
  'Phone Number'?: string;
  Address?: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  adjustment: number;
  lineTotal: number;
}

interface InvoiceData {
  date: string;
  dueDate: string;
  logoData: string;
  customerName: string;
  phone: string;
  address: string;
  items: InvoiceItem[];
  subTotal: number;
  creditAmount: number;
  orderTotal: number;
  reservationFee?: number;
}

interface InvoiceSettings {
  format: 'pdf' | 'png';
  pngQuality: number;
}

type InvoiceType =
  | 'In Transit'
  | 'Onhand'
  | 'Reservation Fee'
  | 'Reservation Fee 20';

interface ReservationInvoiceConfig {
  template: string;
  rate: number;
  zipBase: string;
}

const SETTINGS_FILE = path.join(
  process.cwd(),
  'settings',
  'invoice-settings.json'
);

const DEFAULT_SETTINGS: InvoiceSettings = {
  format: 'png',
  pngQuality: 8,
};

/**
 * Read invoice settings from file
 */
function getInvoiceSettings(): InvoiceSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(fileContent) as InvoiceSettings;
    }
  } catch (error) {
    logger.error('Failed to read invoice settings, using defaults:', error);
  }
  return DEFAULT_SETTINGS;
}

// Register Handlebars helper for currency formatting
Handlebars.registerHelper(
  'currency',
  function (value: number | null | undefined) {
    if (value === null || value === undefined || isNaN(value)) {
      return '₱0.00';
    }
    return (
      '₱' +
      value.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
);

export async function POST(request: NextRequest) {
  try {
    // Get invoice settings
    const settings = getInvoiceSettings();

    const body = await request.json();
    const { transactions, customers, invoiceType } = body as {
      transactions: Transaction[];
      customers: Customer[];
      invoiceType?: InvoiceType;
    };

    const normalizedInvoiceType: InvoiceType =
      invoiceType === 'In Transit'
        ? 'In Transit'
        : invoiceType === 'Reservation Fee 20'
          ? 'Reservation Fee 20'
          : invoiceType === 'Reservation Fee'
            ? 'Reservation Fee'
            : 'Onhand';

    const reservationInvoiceConfig: ReservationInvoiceConfig | null =
      normalizedInvoiceType === 'Reservation Fee'
        ? {
            template: 'invoice (10% dp).hbs',
            rate: 0.1,
            zipBase: 'reservation-fee-invoices',
          }
        : normalizedInvoiceType === 'Reservation Fee 20'
          ? {
              template: 'invoice (20% dp).hbs',
              rate: 0.2,
              zipBase: 'reservation-fee-20-invoices',
            }
          : null;

    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions provided' },
        { status: 400 }
      );
    }

    // Apply filters based on invoice type
    let eligibleTransactions: Transaction[];

    if (reservationInvoiceConfig) {
      // For reservation invoices (10% or 20% DP):
      // Only include transactions with Adjustment = 0.00 (unpaid reservation fees)
      eligibleTransactions = transactions.filter(
        (t) => Number(t.Adjustment) === 0 || !t.Adjustment
      );
    } else {
      // For standard invoices: no filtering needed
      // Frontend already sends the correct transactions
      eligibleTransactions = transactions;
    }

    if (eligibleTransactions.length === 0) {
      return NextResponse.json(
        {
          error: 'No eligible transactions',
          message: reservationInvoiceConfig
            ? 'All transactions have already paid their reservation fees (Adjustment ≠ 0.00)'
            : 'No transactions provided for invoice generation',
        },
        { status: 400 }
      );
    }

    // Group transactions by customer
    const groupedByCustomer = new Map<string, Transaction[]>();

    eligibleTransactions.forEach((transaction: Transaction) => {
      const customer = transaction.Customers || 'Unknown Customer';
      if (!groupedByCustomer.has(customer)) {
        groupedByCustomer.set(customer, []);
      }
      const group = groupedByCustomer.get(customer);
      if (group) {
        group.push(transaction);
      }
    });

    // Read the invoice template
    const templatePath = path.join(
      process.cwd(),
      'templates',
      reservationInvoiceConfig?.template ?? 'invoice.hbs'
    );
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    // Read and encode logo
    const logoPath = path.join(
      process.cwd(),
      'templates',
      'images',
      'logo.png'
    );
    const logoBuffer = fs.readFileSync(logoPath);
    const logoData = logoBuffer.toString('base64');

    const browser = await chromium.launch({
      headless: true,
      executablePath: chromium.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 817, height: 1056 },
      deviceScaleFactor: settings.pngQuality,
    });

    const page = await context.newPage();
    const imageBuffers: Buffer[] = [];

    // Calculate dates
    const now = new Date();
    const invoiceDate = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateFormatted = dueDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Generate a PDF for each customer
    for (const [customerName, customerTransactions] of Array.from(
      groupedByCustomer.entries()
    )) {
      // Find customer details
      const customerData = customers?.find(
        (c: Customer) => c['Customer Name'] === customerName
      );

      const phone = customerData?.['Phone Number'] || '';
      const address = customerData?.Address || '';

      // Create invoice items with sanitization
      const items: InvoiceItem[] = customerTransactions.map(
        (transaction: Transaction) => ({
          description: sanitizers.productCode(
            transaction['Product Code'] || ''
          ),
          quantity: transaction.Quantity || 0,
          unitPrice: transaction['Unit Price'] || 0,
          adjustment: transaction.Adjustment || 0,
          lineTotal: transaction['Line Total'] || 0,
        })
      );

      // Calculate totals
      const subTotal = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const creditAmount = items.reduce(
        (sum, item) => sum + item.adjustment,
        0
      );
      const orderTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

      // Sanitize customer data for PDF generation
      const reservationFeeAmount = reservationInvoiceConfig
        ? Number((subTotal * reservationInvoiceConfig.rate).toFixed(2))
        : undefined;

      const invoiceData: InvoiceData = {
        date: invoiceDate,
        dueDate: dueDateFormatted,
        logoData,
        customerName: sanitizers.name(customerName),
        phone: sanitizers.phone(phone),
        address: sanitizers.address(address),
        items,
        subTotal,
        creditAmount,
        orderTotal,
        reservationFee: reservationInvoiceConfig
          ? reservationFeeAmount
          : undefined,
      };

      const html = template(invoiceData);

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      // Give a moment for fonts to load
      await new Promise((resolve) =>
        setTimeout(resolve, LOADING_SPINNER_DELAY)
      );

      // Generate based on settings format
      if (settings.format === 'png') {
        // Set viewport for high-definition PNG output
        await page.setViewportSize({
          width: 817,
          height: 1056, // A4 height in pixels
        });

        // Generate high-definition PNG screenshot
        const imageBuffer = await page.screenshot({
          type: 'png',
          fullPage: true,
          omitBackground: false,
        });

        imageBuffers.push(Buffer.from(imageBuffer));
      } else {
        // Generate PDF
        const pdfBuffer = await page.pdf({
          width: '817px',
          printBackground: true,
          margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
        });

        imageBuffers.push(Buffer.from(pdfBuffer));
      }
    }

    await browser.close();

    // Determine file extension and content type based on settings
    const fileExtension = settings.format === 'png' ? 'png' : 'pdf';
    const contentType =
      settings.format === 'png' ? 'image/png' : 'application/pdf';

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const customerNames = Array.from(groupedByCustomer.keys());

    const generatedFiles = imageBuffers.map((imageBuffer, index) => {
      const customerName = customerNames[index] || 'Unknown Customer';
      const sanitizedBase = customerName
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .trim();
      const safeBase =
        sanitizedBase.length > 0 ? sanitizedBase : `customer-${index + 1}`;

      return {
        name: `${safeBase}.${fileExtension}`,
        buffer: imageBuffer,
      };
    });

    // If only one customer, return single file
    if (generatedFiles.length === 1) {
      const [{ name, buffer }] = generatedFiles;
      const encodedName = encodeURIComponent(name);

      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${encodedName}"`,
        },
      });
    }

    // If multiple customers, create a zip file using dynamic import
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    generatedFiles.forEach(({ name, buffer }) => {
      zip.file(name, buffer);
    });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Return the zip file
    const zipFilenameBase = reservationInvoiceConfig
      ? reservationInvoiceConfig.zipBase
      : 'invoices';

    return new NextResponse(Buffer.from(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilenameBase}-${timestamp}.zip"`,
      },
    });
  } catch (error) {
    logger.error('Error generating invoice:', {
      chromiumPath: chromium.executablePath(),
      error,
    });
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}

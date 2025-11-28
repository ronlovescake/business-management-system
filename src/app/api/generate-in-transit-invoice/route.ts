import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
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
}

interface InvoiceSettings {
  format: 'pdf' | 'png';
  pngQuality: number;
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

const DUE_DATE_PLACEHOLDER = 'NOT YET ONHAND';
const TEMPLATE_FILE = 'invoice (In Transit).hbs';

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
    const settings = getInvoiceSettings();

    const body = await request.json();
    const { transactions, customers } = body as {
      transactions: Transaction[];
      customers: Customer[];
    };

    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions provided' },
        { status: 400 }
      );
    }

    const eligibleTransactions = transactions.filter(
      (transaction) => transaction['Order Status'] === 'In Transit'
    );

    if (eligibleTransactions.length === 0) {
      return NextResponse.json(
        {
          error: 'No eligible transactions',
          message: 'Only "In Transit" transactions can be invoiced.',
        },
        { status: 400 }
      );
    }

    const groupedByCustomer = new Map<string, Transaction[]>();

    eligibleTransactions.forEach((transaction: Transaction) => {
      const customer = transaction.Customers || 'Unknown Customer';
      if (!groupedByCustomer.has(customer)) {
        groupedByCustomer.set(customer, []);
      }
      groupedByCustomer.get(customer)?.push(transaction);
    });

    const templatePath = path.join(process.cwd(), 'templates', TEMPLATE_FILE);
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    const logoPath = path.join(
      process.cwd(),
      'templates',
      'images',
      'logo.png'
    );
    const logoBuffer = fs.readFileSync(logoPath);
    const logoData = logoBuffer.toString('base64');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const imageBuffers: Buffer[] = [];

    const now = new Date();
    const invoiceDate = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    for (const [customerName, customerTransactions] of Array.from(
      groupedByCustomer.entries()
    )) {
      const customerData = customers?.find(
        (c: Customer) => c['Customer Name'] === customerName
      );

      const phone = customerData?.['Phone Number'] || '';
      const address = customerData?.Address || '';

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

      const subTotal = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const creditAmount = items.reduce(
        (sum, item) => sum + item.adjustment,
        0
      );
      const orderTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

      const invoiceData: InvoiceData = {
        date: invoiceDate,
        dueDate: DUE_DATE_PLACEHOLDER,
        logoData,
        customerName: sanitizers.name(customerName),
        phone: sanitizers.phone(phone),
        address: sanitizers.address(address),
        items,
        subTotal,
        creditAmount,
        orderTotal,
      };

      const html = template(invoiceData);

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      await new Promise((resolve) =>
        setTimeout(resolve, LOADING_SPINNER_DELAY)
      );

      if (settings.format === 'png') {
        await page.setViewport({
          width: 817,
          height: 1056,
          deviceScaleFactor: settings.pngQuality,
        });

        const imageBuffer = await page.screenshot({
          type: 'png',
          fullPage: true,
          omitBackground: false,
        });

        imageBuffers.push(Buffer.from(imageBuffer));
      } else {
        const pdfBuffer = await page.pdf({
          width: '817px',
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        imageBuffers.push(Buffer.from(pdfBuffer));
      }
    }

    await browser.close();

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

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    generatedFiles.forEach(({ name, buffer }) => {
      zip.file(name, buffer);
    });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(Buffer.from(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="in-transit-invoices-${timestamp}.zip"`,
      },
    });
  } catch (error) {
    logger.error('Error generating In Transit invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate In Transit invoice' },
      { status: 500 }
    );
  }
}

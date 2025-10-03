// ==============================================================================
// ⚠️⚠️⚠️ CRITICAL WARNING - READ BEFORE MAKING ANY CHANGES ⚠️⚠️⚠️
// ==============================================================================
//
// This API generates invoice PDFs for transactions with "Warehouse" status.
//
// ✅ BUSINESS LOGIC - DO NOT MODIFY:
//    - Filter: Only "Warehouse" Order Status transactions
//    - Group by customer: One invoice per customer
//    - Invoice Date: Auto-populate if empty (format: "October 3, 2025")
//    - Due Date: Invoice Date + 3 days
//    - Include ALL warehouse transactions regardless of existing Invoice Date
//    - DO NOT overwrite existing Invoice Date timestamps
//    - DO NOT touch PACKED DATE or SHIPMENT CODE columns
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

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

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

    // No filtering needed - frontend already sends the correct transactions
    // (Warehouse + Prepared for customers with Warehouse items)
    const eligibleTransactions = transactions;

    if (eligibleTransactions.length === 0) {
      return NextResponse.json(
        {
          error: 'No eligible transactions',
          message: 'No transactions provided for invoice generation',
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
      groupedByCustomer.get(customer)!.push(transaction);
    });

    // Read the invoice template
    const templatePath = path.join(process.cwd(), 'templates', 'invoice.hbs');
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

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const pdfBuffers: Buffer[] = [];

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

      // Create invoice items
      const items: InvoiceItem[] = customerTransactions.map(
        (transaction: Transaction) => ({
          description: transaction['Product Code'] || '',
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

      const invoiceData: InvoiceData = {
        date: invoiceDate,
        dueDate: dueDateFormatted,
        logoData,
        customerName,
        phone,
        address,
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

      // Give a moment for fonts to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Generate PDF (817px width, auto height)
      const pdfBuffer = await page.pdf({
        width: '817px',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      pdfBuffers.push(Buffer.from(pdfBuffer));
    }

    await browser.close();

    // Merge all PDFs into one
    const mergedPdf = await PDFDocument.create();

    for (const pdfBuffer of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const mergedPdfBuffer = Buffer.from(mergedPdfBytes);

    // Save the merged PDF to the invoices directory
    const outputDir = path.join(process.cwd(), 'pdf_output', 'invoices');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputPath = path.join(outputDir, `invoices-${timestamp}.pdf`);
    fs.writeFileSync(outputPath, mergedPdfBuffer);

    // Return the PDF
    return new NextResponse(mergedPdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="invoices.pdf"',
      },
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}

// ==============================================================================
// ⚠️⚠️⚠️ CRITICAL WARNING - READ BEFORE MAKING ANY CHANGES ⚠️⚠️⚠️
// ==============================================================================
//
// This API route generates packing lists for order fulfillment operations.
// The PDF generation logic has been carefully designed and tested.
//
// ✅ ALLOWED MODIFICATIONS:
//    - Fix TypeScript/ESLint errors or warnings
//    - Fix runtime bugs that break functionality
//    - Improve code structure/organization (refactoring)
//    - Performance optimizations
//    - Update styling/template (in packinglist.hbs file)
//
// ❌ FORBIDDEN MODIFICATIONS (without explicit business approval):
//    - Change grouping logic (by customer)
//    - Modify PDF format, size, or orientation (A6 landscape)
//    - Alter the template rendering process
//    - Change file saving location or naming convention
//    - Modify Puppeteer timeout or wait settings (unless fixing bugs)
//    - Change the 12-row table structure
//
// 📋 CURRENT SPECIFICATIONS - DO NOT CHANGE:
//    - Page Size: A6 Landscape (148mm x 105mm)
//    - One page per customer (grouped transactions)
//    - Table: Line #, Quantity, Product Code (12 rows fixed)
//    - Streams PDF response to client without persisting on server
//    - Template: templates/packinglist.hbs
//    - Groups multiple transactions by customer
//
// 🚨 IF YOU NEED TO CHANGE THE BUSINESS LOGIC:
//    1. DO NOT proceed without business owner approval
//    2. Test thoroughly with real production data
//    3. Verify PDF output matches business requirements
//    4. Update this warning comment to reflect new specifications
//
// ==============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars/dist/cjs/handlebars';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

// Register Handlebars helper for empty rows
Handlebars.registerHelper(
  'emptyRows',
  function (rows: unknown[], maxRows: number) {
    const currentRows = Array.isArray(rows) ? rows.length : 0;
    const emptyCount = Math.max(0, maxRows - currentRows);
    return new Array(emptyCount).fill({});
  }
);

interface Transaction {
  Customers: string;
  'Product Code': string;
  Quantity: number;
  Notes?: string;
}

interface PackingListRow {
  line: number;
  quantity: number;
  productCode: string;
}

interface PackingListData {
  customer: string;
  rows: PackingListRow[];
  note: string;
}

export async function POST(request: NextRequest) {
  try {
    const { transactions } = await request.json();

    if (
      !transactions ||
      !Array.isArray(transactions) ||
      transactions.length === 0
    ) {
      return NextResponse.json(
        { error: 'No transactions provided' },
        { status: 400 }
      );
    }

    // Group transactions by customer
    const groupedByCustomer = new Map<string, Transaction[]>();

    transactions.forEach((transaction: Transaction) => {
      const customer = transaction.Customers || 'Unknown Customer';
      if (!groupedByCustomer.has(customer)) {
        groupedByCustomer.set(customer, []);
      }
      const customerGroup = groupedByCustomer.get(customer);
      if (customerGroup) {
        customerGroup.push(transaction);
      }
    });

    // Read the packing list template
    const templatePath = path.join(
      process.cwd(),
      'templates',
      'packinglist.hbs'
    );
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const pdfBuffers: Buffer[] = [];

    // Generate a PDF page for each customer (sorted alphabetically)
    const collator = new Intl.Collator(undefined, {
      sensitivity: 'base',
      ignorePunctuation: true,
    });

    const sortedCustomers = Array.from(groupedByCustomer.entries()).sort(
      ([a], [b]) => collator.compare(a, b)
    );

    for (const [customer, customerTransactions] of sortedCustomers) {
      // Create rows for this customer's packing list
      const rows: PackingListRow[] = customerTransactions.map(
        (transaction: Transaction, index: number) => ({
          line: index + 1,
          quantity: transaction.Quantity || 0,
          productCode: transaction['Product Code'] || '',
        })
      );

      // Collect notes (use first non-empty note if any)
      const note =
        customerTransactions
          .map((t: Transaction) => t.Notes)
          .find((n: string | undefined) => n && n.trim()) || '';

      const packingListData: PackingListData = {
        customer,
        rows,
        note,
      };

      const html = template(packingListData);

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      // Give a moment for fonts to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Generate PDF for this customer (A6 landscape)
      const pdfBuffer = await page.pdf({
        format: 'A6',
        landscape: true,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      pdfBuffers.push(Buffer.from(pdfBuffer));
    }

    await browser.close();

    // Merge all PDF buffers into one
    const { PDFDocument } = await import('pdf-lib');

    const mergedPdf = await PDFDocument.create();

    for (const pdfBuffer of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `packing-list-${timestamp}.pdf`;

    // Return the PDF directly without saving to disk
    return new NextResponse(Buffer.from(mergedPdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Error generating packing list PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate packing list PDF',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

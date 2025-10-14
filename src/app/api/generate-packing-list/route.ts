import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { logger } from '@/lib/logger';

interface Transaction {
  id: string;
  orderDate: string;
  customers: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  adjustment: number;
  lineTotal: number;
  orderStatus?: string; // Made optional since frontend might send 'status' instead
  status?: string; // Added to handle frontend data structure
  notes?: string;
  invoiceDate?: string;
  packedDate?: string;
  shipmentCode?: string;
}

interface PackingListRow {
  line: number;
  quantity: number;
  productCode: string;
}

interface CustomerPackingList {
  customer: string;
  rows: PackingListRow[];
  note: string;
}

// Register emptyRows helper for Handlebars
handlebars.registerHelper(
  'emptyRows',
  function (rows: PackingListRow[], totalRows: number) {
    const emptyCount = Math.max(0, totalRows - rows.length);
    return new Array(emptyCount).fill({});
  }
);

export async function POST(request: NextRequest) {
  try {
    const transactions: Transaction[] = await request.json();

    logger.debug('📋 PACKING LIST GENERATION STARTED');
    logger.debug(`📊 Total transactions received: ${transactions.length}`);

    // Debug: Log first few transactions to see their structure
    logger.debug('🔍 Sample transaction data:', transactions.slice(0, 2));

    // Filter transactions based on validation rules
    const filteredTransactions = transactions.filter((transaction) => {
      // Rule 1: Only "Prepared" status
      // Handle both 'status' (from frontend) and 'orderStatus' (from database)
      const status = transaction.status || transaction.orderStatus;
      if (status !== 'Prepared') {
        return false;
      }

      // Rule 2: Line total not more than ₱50.00
      if (transaction.lineTotal > 50.0) {
        return false;
      }

      return true;
    });

    logger.debug(
      `✅ Filtered transactions: ${filteredTransactions.length} (Prepared status & ≤₱50.00)`
    );

    if (filteredTransactions.length === 0) {
      return NextResponse.json(
        {
          error:
            'No transactions meet the packing list criteria (Prepared status & line total ≤₱50.00)',
        },
        { status: 400 }
      );
    }

    // Group by customer
    const customerGroups = new Map<string, Transaction[]>();

    filteredTransactions.forEach((transaction) => {
      const customer = transaction.customers;
      const existingTransactions = customerGroups.get(customer);
      if (existingTransactions) {
        existingTransactions.push(transaction);
        return;
      }
      customerGroups.set(customer, [transaction]);
    });

    logger.debug(`👥 Grouped into ${customerGroups.size} customers`);

    // Generate packed date (current date in required format)
    const currentDate = new Date();
    const packedDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    logger.debug(`📅 Packed Date: ${packedDate}`);

    // Create packing list data for each customer
    const customerPackingLists: CustomerPackingList[] = [];

    customerGroups.forEach((transactions, customer) => {
      const rows: PackingListRow[] = transactions.map((transaction, index) => ({
        line: index + 1,
        quantity: transaction.quantity,
        productCode: transaction.productCode,
      }));

      // Combine notes from all transactions for this customer
      const notes = transactions
        .map((t) => t.notes)
        .filter((note) => note && note.trim())
        .join('; ');

      customerPackingLists.push({
        customer,
        rows,
        note: notes || '',
      });

      logger.debug(`📦 ${customer}: ${rows.length} items`);
    });

    // Load and compile template
    const templatePath = path.join(
      process.cwd(),
      'templates',
      'packinglist.hbs'
    );
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const pages: Uint8Array[] = [];

    // Generate a page for each customer
    for (const packingList of customerPackingLists) {
      const html = template({
        customer: packingList.customer,
        rows: packingList.rows,
        note: packingList.note,
      });

      const page = await browser.newPage();
      await page.setContent(html);

      const pdfBuffer = await page.pdf({
        format: 'A6',
        landscape: true,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      pages.push(pdfBuffer);
      await page.close();
    }

    await browser.close();

    // Merge all customer pages into one multi-page PDF document
    const mergedPdf = await PDFDocument.create();

    for (const pdfBuffer of pages) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const finalPdf = Buffer.from(mergedPdfBytes);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `packing-lists-${timestamp}.pdf`;

    logger.debug('✅ PACKING LIST GENERATION COMPLETED');
    logger.debug(`📄 Generated ${pages.length} packing slips`);
    logger.debug(`💾 Filename: ${filename}`);

    return new NextResponse(finalPdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('❌ Error generating packing list:', error);
    return NextResponse.json(
      { error: 'Failed to generate packing list' },
      { status: 500 }
    );
  }
}

// ==============================================================================
// 📦 DISTRIBUTION SLIP GENERATION API
// ==============================================================================
//
// This API generates distribution/sorting slips for warehouse operations.
//
// ✅ BUSINESS LOGIC:
//    - Filter: Only "Warehouse" Order Status transactions
//    - Sort: Ascending order by Quantity
//    - One slip per transaction line/row
//    - A6 landscape format for easy handling
//    - Multi-page PDF output (like invoice system)
//
// 📋 SLIP CONTENT:
//    - Customer Name (prominent display)
//    - Product Code
//    - Quantity
//    - Background logo (watermark)
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
  'Order Status'?: string;
}

interface DistributionSlipData {
  customer: string;
  productCode: string;
  quantity: number;
  logoDataUri?: string;
  currentDate: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactions } = body as {
      transactions: Transaction[];
    };

    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions provided' },
        { status: 400 }
      );
    }

    // Filter only "Warehouse" status transactions
    const warehouseTransactions = transactions.filter(
      (transaction: Transaction) => transaction['Order Status'] === 'Warehouse'
    );

    if (warehouseTransactions.length === 0) {
      return NextResponse.json(
        {
          error: 'No warehouse transactions found',
          message:
            'No transactions with "Warehouse" status found for distribution slip generation',
        },
        { status: 400 }
      );
    }

    // Sort transactions by Quantity in ascending order
    const sortedTransactions = warehouseTransactions.sort(
      (a: Transaction, b: Transaction) => (a.Quantity || 0) - (b.Quantity || 0)
    );

    // Read the distribution template
    const templatePath = path.join(
      process.cwd(),
      'templates',
      'distribution.hbs'
    );
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    // Read and encode logo
    let logoDataUri = '';
    try {
      const logoPath = path.join(
        process.cwd(),
        'templates',
        'images',
        'logo.png'
      );
      const logoBuffer = fs.readFileSync(logoPath);
      logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (logoError) {
      console.warn('Logo file not found, using placeholder');
    }

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const pdfBuffers: Buffer[] = [];

    // Current date for slips
    const currentDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Generate one slip per transaction
    for (const transaction of sortedTransactions) {
      const slipData: DistributionSlipData = {
        customer: transaction.Customers || 'Unknown Customer',
        productCode: transaction['Product Code'] || 'N/A',
        quantity: transaction.Quantity || 0,
        logoDataUri,
        currentDate,
      };

      const html = template(slipData);

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      // Give a moment for fonts to load
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Generate PDF (A6 landscape: 148mm x 105mm)
      const pdfBuffer = await page.pdf({
        format: 'A6',
        landscape: true,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      pdfBuffers.push(Buffer.from(pdfBuffer));
    }

    await browser.close();

    // Merge all PDFs into one multi-page document
    const mergedPdf = await PDFDocument.create();

    for (const pdfBuffer of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const mergedPdfBuffer = Buffer.from(mergedPdfBytes);

    // Save the merged PDF to the distribution directory
    const outputDir = path.join(process.cwd(), 'pdf_output', 'distribution');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputPath = path.join(
      outputDir,
      `distribution-slips-${timestamp}.pdf`
    );
    fs.writeFileSync(outputPath, mergedPdfBuffer);

    console.log(
      `✅ Generated ${sortedTransactions.length} distribution slips (sorted by quantity ascending)`
    );

    // Return the PDF
    return new NextResponse(mergedPdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="distribution-slips.pdf"',
      },
    });
  } catch (error) {
    console.error('Error generating distribution slips:', error);
    return NextResponse.json(
      { error: 'Failed to generate distribution slips' },
      { status: 500 }
    );
  }
}

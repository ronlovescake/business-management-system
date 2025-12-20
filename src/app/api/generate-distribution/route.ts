// ==============================================================================
// ⚠️⚠️⚠️ CRITICAL WARNING - READ BEFORE MAKING ANY CHANGES ⚠️⚠️⚠️
// ==============================================================================
//
// This API route generates distribution slips for warehouse operations.
// The PDF generation logic has been carefully designed and tested.
//
// ✅ ALLOWED MODIFICATIONS:
//    - Fix TypeScript/ESLint errors or warnings
//    - Fix runtime bugs that break functionality
//    - Improve code structure/organization (refactoring)
//    - Performance optimizations
//    - Update styling/template (in distribution.hbs file)
//
// ❌ FORBIDDEN MODIFICATIONS (without explicit business approval):
//    - Change data extraction logic (Customers, Product Code, Quantity)
//    - Modify PDF format, size, or orientation (A6 landscape)
//    - Alter the template rendering process
//    - Change file saving location or naming convention
//    - Modify browser timeout or wait settings (unless fixing bugs)
//
// 📋 CURRENT SPECIFICATIONS - DO NOT CHANGE:
//    - Page Size: A6 Landscape (148mm x 105mm)
//    - One page per transaction
//    - Fields: Customer Name, Quantity, Product Code
//    - Logo embedded as base64 data URI
//    - Streams PDF response to client without persisting on server
//    - Template: templates/distribution.hbs
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
import { chromium } from 'playwright';
import Handlebars from 'handlebars/dist/cjs/handlebars';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

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

    // Read the distribution template
    const templatePath = path.join(
      process.cwd(),
      'templates',
      'distribution.hbs'
    );
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    // Read the logo and convert to data URI
    const logoPath = path.join(
      process.cwd(),
      'templates',
      'images',
      'logo.png'
    );
    let logoDataUri = '';
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const pdfBuffers: Buffer[] = [];

    // Generate a PDF page for each transaction (sorted by quantity ascending)
    const sortedTransactions = [...transactions].sort((a, b) => {
      const qtyA = Number(a.Quantity) || 0;
      const qtyB = Number(b.Quantity) || 0;
      return qtyA - qtyB;
    });

    for (const transaction of sortedTransactions) {
      const html = template({
        customer: transaction.Customers || '',
        quantity: transaction.Quantity || 0,
        productCode: transaction['Product Code'] || '',
        logoDataUri,
      });

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      // Give a moment for fonts to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Generate PDF for this single transaction (A6 landscape)
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
    // For simplicity, we'll use PDFLib or return individual PDFs
    // Here, I'll concatenate them (you might want to use pdf-lib for proper merging)
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
    const filename = `distribution-slips-${timestamp}.pdf`;

    // Return the PDF directly without saving to disk
    return new NextResponse(Buffer.from(mergedPdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Error generating distribution PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate distribution PDF',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

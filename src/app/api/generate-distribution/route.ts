import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

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

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const pdfBuffers: Buffer[] = [];

    // Generate a PDF page for each transaction
    for (const transaction of transactions) {
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

    // Save the PDF to the pdf_output directory
    const outputDir = path.join(process.cwd(), 'pdf_output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `distribution-slips-${timestamp}.pdf`;
    const outputPath = path.join(outputDir, filename);

    fs.writeFileSync(outputPath, mergedPdfBytes);
    console.log(`✅ Distribution PDF saved to: ${outputPath}`);

    // Return the PDF
    return new NextResponse(Buffer.from(mergedPdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="distribution-slips-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating distribution PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate distribution PDF',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
